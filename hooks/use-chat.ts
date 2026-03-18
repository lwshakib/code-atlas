"use client";

import { useState, useCallback, useRef } from "react";
import { nanoid } from "nanoid";

export type ToolInvocation = {
  id: string;
  tool: string;
  status: "calling" | "success" | "error";
  result?: unknown;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolInvocations?: ToolInvocation[];
};

export interface UseChatOptions {
  api: string;
  initialMessages?: Message[];
}

export function useChat({ api, initialMessages = [] }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesRef = useRef<Message[]>(initialMessages);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const append = useCallback(async (newMessage: { role: "user"; content: string }) => {
    const userMessage: Message = { id: nanoid(), ...newMessage };
    
    setMessages((prev) => {
      const next = [...prev, userMessage];
      messagesRef.current = next;
      return next;
    });
    
    setIsLoading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: messagesRef.current.map(({ role, content }) => ({ role, content })) 
        }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No readable stream in response");

      const assistantMessageId = nanoid();
      setMessages((prev) => {
         const next = [...prev, { id: assistantMessageId, role: "assistant" as const, content: "", toolInvocations: [] }];
         messagesRef.current = next;
         return next;
      });

      let accumulatedContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            if (data.type === "text") {
              accumulatedContent += data.content;
              setMessages((prev) => {
                const updated = prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg
                );
                messagesRef.current = updated;
                return updated;
              });
            } else if (data.type === "tool") {
              console.log(`[useChat] Tool ${data.status}: ${data.tool} (${data.id})`, data.result || "");
              setMessages((prev) => {
                const updated = prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  const tools = [...(msg.toolInvocations || [])];
                  const existingIdx = tools.findIndex(t => t.id === data.id);
                  if (existingIdx > -1) {
                    tools[existingIdx] = { ...tools[existingIdx], status: data.status, result: data.result };
                  } else {
                    tools.push({ id: data.id, tool: data.tool, status: data.status, result: data.result });
                  }
                  return { ...msg, toolInvocations: tools };
                });
                messagesRef.current = updated;
                return updated;
              });
            }
          } catch {
            // If it's not JSON, it might be raw text 
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
  }, [api]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const content = input;
    setInput(""); // Clear input early
    await append({ role: "user", content });
  }, [input, isLoading, append]);

  return { 
    messages, 
    input, 
    setInput, 
    append, 
    isLoading, 
    stop,
    handleSubmit,
    setMessages 
  };
}
