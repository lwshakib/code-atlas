/**
 * USE CHAT HOOK
 *
 * A custom implementation of a streaming chat hook designed to work with
 * our specific multi-modal LLM response format (text + tool calls).
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { nanoid } from "nanoid";

/**
 * TOOL INVOCATION TYPE
 * Represents a discrete step in an AI's tool-calling pipeline (e.g., searching a database).
 */
export type ToolInvocation = {
  id: string;
  tool: string;
  status: "calling" | "success" | "error";
  result?: unknown;
};

/**
 * MESSAGE TYPE
 * A single entry in the conversation history, optionally containing tool results.
 */
export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolInvocations?: ToolInvocation[];
};

export interface UseChatOptions {
  api: string; // The URL to send the POST request to
  initialMessages?: Message[];
}

export function useChat({ api, initialMessages = [] }: UseChatOptions) {
  // UI State: Controlled by standard React state
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Persistence State: Used to safely access messages inside async closures without stale captures
  const messagesRef = useRef<Message[]>(initialMessages);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * STOP HANDLER
   * Interrupts the current streaming request and resets loading labels.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  /**
   * APPEND HANDLER
   * The core engine for sending messages and piping the stream into state.
   */
  const append = useCallback(
    async (newMessage: { role: "user"; content: string }) => {
      const userMessage: Message = { id: nanoid(), ...newMessage };

      // 1. Update UI with the user's message immediately
      setMessages((prev) => {
        const next = [...prev, userMessage];
        messagesRef.current = next;
        return next;
      });

      setIsLoading(true);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // 2. Transmit conversation history to the API
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesRef.current.map(({ role, content }) => ({
              role,
              content,
            })),
          }),
          signal: abortController.signal,
        });

        if (!response.ok)
          throw new Error(`Fetch failed with status: ${response.status}`);

        // 3. Setup stream readers
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No readable stream in response");

        const assistantMessageId = nanoid();
        // Inject a blank assistant message that will be populated as the stream arrives
        setMessages((prev) => {
          const next = [
            ...prev,
            {
              id: assistantMessageId,
              role: "assistant" as const,
              content: "",
              toolInvocations: [],
            },
          ];
          messagesRef.current = next;
          return next;
        });

        let accumulatedContent = "";
        let buffer = ""; // Buffer to handle partial JSON chunks split across network packets

        /**
         * STREAM PROCESSING LOOP
         * Reads binary chunks, decodes them to text, and parses line-delimited JSON.
         */
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Split by standard newline
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

            const jsonStr = trimmedLine.slice(6);

            try {
              const data = JSON.parse(jsonStr);

              // Branch 1: Incremental Text Updates
              if (data.type === "text") {
                accumulatedContent += data.content;
                setMessages((prev) => {
                  const updated = prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg,
                  );
                  messagesRef.current = updated;
                  return updated;
                });
              }
              // Branch 2: Tool Invocation Updates
              else if (data.type === "tool") {
                setMessages((prev) => {
                  const updated = prev.map((msg) => {
                    if (msg.id !== assistantMessageId) return msg;
                    const tools = [...(msg.toolInvocations || [])];
                    const existingIdx = tools.findIndex(
                      (t) => t.id === data.id,
                    );
                    if (existingIdx > -1) {
                      // Update existing tool (e.g. from 'calling' to 'success')
                      tools[existingIdx] = {
                        ...tools[existingIdx],
                        status: data.status,
                        result: data.result,
                      };
                    } else {
                      // Inject a brand new tool call
                      tools.push({
                        id: data.id,
                        tool: data.tool,
                        status: data.status,
                        result: data.result,
                      });
                    }
                    return { ...msg, toolInvocations: tools };
                  });
                  messagesRef.current = updated;
                  return updated;
                });
              }
            } catch {
              // Buffer failed to parse: usually happens on partial chunks or non-JSON payloads
            }
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("[useChat] Request aborted");
        } else {
          console.error("[useChat] Error:", error);
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [api],
  );

  /**
   * FORM SUBMISSION HANDLER
   * Consumes the input state and triggers 'append'.
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const content = input;
      setInput(""); // Clear early for better UX
      await append({ role: "user", content });
    },
    [input, isLoading, append],
  );

  return {
    messages,
    input,
    setInput,
    append,
    isLoading,
    stop,
    handleSubmit,
    setMessages,
  };
}
