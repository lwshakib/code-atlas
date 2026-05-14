import { client } from "./client";
import { CHAT_MODEL_ID } from "./constants";

/**
 * GENERATE TEXT
 *
 * Simple text generation function.
 */
export async function generateText(
  messages: { role: string; content: string }[],
): Promise<string> {
  // Extract system instruction and conversation history
  const systemInstruction = messages.find((m) => m.role === "system")?.content;
  const history = messages
    .filter((m) => m.role !== "system")
    .slice(0, -1)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const lastMessage = messages[messages.length - 1].content;

  const chat = client.chats.create({
    model: CHAT_MODEL_ID,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history: history as any[],
    config: {
      systemInstruction,
      thinkingConfig: {
        includeThoughts: true,
      },
    },
  });

  const response = await chat.sendMessage({
    message: lastMessage,
  });

  const text = response.text;

  if (!text) {
    throw new Error("No text generated in response");
  }

  return text;
}
