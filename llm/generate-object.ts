/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodToJsonSchema } from "zod-to-json-schema";
import { client } from "./client";
import { CHAT_MODEL_ID } from "./constants";
import { z } from "zod";

/**
 * Structured JSON Generation using the Gemini 3 Chat System and Zod.
 * This implementation is optimized for complex schemas and supports conversational history.
 */
export async function generateObject<T>(
  messages: { role: string; content: string }[],
  schema: unknown,
): Promise<T> {
  const jsonSchema =
    schema instanceof z.ZodType
      ? (zodToJsonSchema(schema as any) as any)
      : (schema as any);

  // Clean the schema for Gemini compatibility
  if (jsonSchema.$schema) delete jsonSchema.$schema;
  if (jsonSchema.definitions) delete jsonSchema.definitions;

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

  // Create a chat instance for better structured output reliability
  const chat = client.chats.create({
    model: CHAT_MODEL_ID,
    history: history as any[],
    config: {
      systemInstruction,
      temperature: 1.0,
      responseMimeType: "application/json",
      responseSchema: jsonSchema,
    },
  });

  // Send the last message
  const response = await chat.sendMessage({
    message: lastMessage,
  });

  const text = response.text;

  if (!text) {
    throw new Error("No content generated for object");
  }

  try {
    // Note: Gemini's chat.sendMessage usually returns cleaned JSON
    // when responseMimeType is application/json
    return JSON.parse(text) as T;
  } catch {
    console.error("Failed to parse AI response as JSON. Raw text:", text);
    throw new Error("AI returned invalid JSON structure");
  }
}
