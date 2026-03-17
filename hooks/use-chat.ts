"use client";

import { useState, useCallback, useRef } from "react";
import { nanoid } from "nanoid";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export interface UseChatOptions {
  api: string;
  initialMessages?: Message[];
}

/**
 * A custom replacement for ai/react useChat hook.
 * Handles streaming text responses from the GLM worker API routes.
 */
export function useChat({ api, initialMessages = [] }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Use a ref for messages to always have the latest state for new requests
  const messagesRef = useRef<Message[]>(initialMessages);

  const append = useCallback(async (newMessage: { role: "user"; content: string }) => {
    const userMessage: Message = { id: nanoid(), ...newMessage };
    
    // Add user message to state
    setMessages((prev) => {
      const next = [...prev, userMessage];
      messagesRef.current = next;
      return next;
    });
    
    setIsLoading(true);

    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: messagesRef.current.map(({ role, content }) => ({ role, content })) 
        }),
      });

      if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No readable stream in response");

      // Initialize assistant message
      const assistantMessageId = nanoid();
      setMessages((prev) => {
         const next = [...prev, { id: assistantMessageId, role: "assistant" as const, content: "" }];
         messagesRef.current = next;
         return next;
      });

      let accumulatedContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulatedContent += chunk;

        // Update the assistant message in real-time
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg
          );
          messagesRef.current = updated;
          return updated;
        });
      }
    } catch (error) {
      console.error("[useChat] Error:", error);
    } finally {
      setIsLoading(false);
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
    handleSubmit,
    setMessages 
  };
}
