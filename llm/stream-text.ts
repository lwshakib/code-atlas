/* eslint-disable @typescript-eslint/no-explicit-any */
import { client } from "./client";
import { CHAT_MODEL_ID } from "./constants";

/**
 * STREAM TEXT (AGENTIC)
 *
 * An agentic streaming function that handles a tool-calling loop.
 * Emits data in a custom SSE-compatible format for the frontend.
 */
export async function streamText(
  messages: { role: string; content: string }[],
  options: {
    tools?: unknown[];
    codebaseId?: string;
    executeTool?: (
      name: string,
      args: Record<string, unknown>,
      codebaseId: string,
      signal?: AbortSignal,
    ) => Promise<unknown>;
    abortSignal?: AbortSignal;
    onFinish?: (result: {
      content: string;
      reasoning?: string;
      toolInvocations: {
        type: string;
        id: string;
        tool: string;
        result: unknown;
      }[];
    }) => Promise<void>;
  },
) {
  const { tools, codebaseId, executeTool, onFinish, abortSignal } = options;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let finalContent = "";
      let finalReasoning = "";
      const finalToolInvocations: {
        type: string;
        id: string;
        tool: string;
        result: unknown;
      }[] = [];

      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Convert message history to Google format
        // Old: { role: 'user', content: '...' }
        // New: { role: 'user', parts: [{ text: '...' }] }
        const history = messages
          .map((m) => {
            if (m.role === "system") return null; // Handled as systemInstruction
            return {
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            };
          })
          .filter(Boolean);
        const systemInstruction = messages.find(
          (m) => m.role === "system",
        )?.content;

        const chat = client.chats.create({
          model: CHAT_MODEL_ID,
          history: history as any[],
          config: {
            systemInstruction,
            tools: tools
              ? ([
                  {
                    functionDeclarations: tools.map(
                      (t) => (t as { function: unknown }).function,
                    ),
                  },
                ] as any)
              : undefined,
            thinkingConfig: {
              includeThoughts: true,
            },
          },
        });

        let toolCallsAttempt = 0;
        let lastParts: unknown[] | null = null;

        while (toolCallsAttempt < 10) {
          if (abortSignal?.aborted) break;

          const stream = lastParts
            ? await chat.sendMessageStream({ message: lastParts as any[] })
            : await chat.sendMessageStream({
                message: messages[messages.length - 1].content,
              });

          lastParts = null; // Clear after use

          const toolCalls: unknown[] = [];

          for await (const chunk of stream) {
            if (abortSignal?.aborted) break;

            const candidate = chunk.candidates?.[0];
            if (!candidate) continue;

            const parts = candidate.content?.parts || [];

            for (const part of parts) {
              // 1. Handle Thought/Reasoning (Thought Signatures)
              if ("thought" in part && part.thought) {
                const thought = String(part.thought);
                finalReasoning += thought;
                sendEvent({ type: "reasoning", content: thought });
              }

              // 2. Handle Text Content
              if (part.text) {
                finalContent += part.text;
                sendEvent({ type: "text", content: part.text });
              }

              // 3. Handle Tool Calls
              if (part.functionCall) {
                toolCalls.push(part.functionCall);
              }
            }
          }

          if (abortSignal?.aborted) break;

          // Execute tools if requested
          if (toolCalls.length > 0) {
            toolCallsAttempt++;
            const toolResponses: any[] = [];

            for (const tc of toolCalls as any[]) {
              const toolName = tc.name;
              const args = tc.args || {};
              sendEvent({
                type: "tool",
                id: tc.id || toolName,
                tool: toolName,
                status: "calling",
              });

              if (executeTool) {
                try {
                  const result = await executeTool(
                    toolName,
                    args,
                    codebaseId || "",
                    abortSignal,
                  );
                  sendEvent({
                    type: "tool",
                    id: tc.id || toolName,
                    tool: toolName,
                    status: "success",
                    result,
                  });
                  finalToolInvocations.push({
                    type: "tool",
                    id: tc.id || toolName,
                    tool: toolName,
                    result,
                  });

                  toolResponses.push({
                    functionResponse: {
                      name: toolName,
                      response: { content: result },
                    },
                  });
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  sendEvent({
                    type: "tool",
                    id: tc.id,
                    tool: toolName,
                    status: "error",
                    result: msg,
                  });
                  finalToolInvocations.push({
                    type: "tool",
                    id: tc.id,
                    tool: toolName,
                    result: `Error: ${msg}`,
                  });

                  toolResponses.push({
                    functionResponse: {
                      name: toolName,
                      response: { error: msg },
                    },
                  });
                }
              }
            }

            // Store tool responses to be sent in the next model turn
            lastParts = toolResponses;
          } else {
            break; // No more tool calls, we are done
          }
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("[LLM_STREAM_ERROR]", err);
          sendEvent({ type: "error", message: "Internal AI processing error" });
        }
      } finally {
        if (onFinish) {
          await onFinish({
            content: finalContent,
            reasoning: finalReasoning || undefined,
            toolInvocations: finalToolInvocations,
          });
        }
        controller.close();
      }
    },
  });
}
