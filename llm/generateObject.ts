/**
 * STRUCTURED OBJECT GENERATION
 *
 * This file provides a utility to force the LLM to return valid JSON
 * that adheres to a specific Zod schema. It includes aggressive sanitization
 * and automatic retry logic for brittle model outputs.
 */

import { z } from "zod";
import { GLM_WORKER_URL, CLOUDFLARE_API_KEY } from "@/lib/env";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * SANITIZE JSON
 *
 * LLMs often wrap JSON in markdown blocks (```json ... ```) or add
 * conversational prefix/suffix text. This function extracts just the { ... } part.
 */
function sanitizeJSON(content: string): string {
  const clean = content.trim();

  // 1. Identify the outermost JSON boundaries
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    // Check for explicit JSON markdown blocks
    const jsonMatch = clean.match(/```json\n?([\s\S]*?)\n?```/i);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }

    // Fallback: Slice everything between the braces
    return clean.substring(firstBrace, lastBrace + 1);
  }

  // 2. Secondary check for markdown blocks if braces weren't clean
  if (clean.includes("```")) {
    const match = clean.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (match) {
      return match[1].trim();
    }
  }

  return clean;
}

/**
 * GENERATE OBJECT FROM GLM
 *
 * High-reliability wrapper for structured LLM interaction.
 *
 * @param messages - The conversation context
 * @param outputSchema - The Zod schema the AI must satisfy
 */
export async function generateObjectFromGLM<T>({
  messages,
  outputSchema,
}: {
  messages: { role: string; content: string }[];
  outputSchema: z.ZodSchema<T>;
}): Promise<T> {
  // Convert Zod to JSON Schema format for the AI's internal validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = zodToJsonSchema(outputSchema as any);
  const schemaString = JSON.stringify(jsonSchema, null, 2);

  // INJECT SCHEMA INSTRUCTIONS
  // We explicitly tell the model it MUST follow the schema.
  const enhancedMessages = [...messages];
  const schemaInstruction = `\n\nCRITICAL: You MUST return a single JSON object that strictly adheres to this JSON Schema:\n${schemaString}\n\nDo not include any other text, explanations, or markdown outside the JSON object.`;

  // Attach the instruction to the system message
  if (enhancedMessages.length > 0 && enhancedMessages[0].role === "system") {
    enhancedMessages[0] = {
      ...enhancedMessages[0],
      content: enhancedMessages[0].content + schemaInstruction,
    };
  } else {
    enhancedMessages.unshift({
      role: "system",
      content: "Complete the following request." + schemaInstruction,
    });
  }

  let lastError: unknown = null;

  // 3-STRIKE RETRY LOOP
  // If the model produces invalid JSON or fails schema validation, we retry up to 3 times.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[GLM generateObject] Initiating Attempt ${attempt}...`);

      const response = await fetch(GLM_WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
        },
        body: JSON.stringify({
          messages: enhancedMessages,
          // Use advanced 'json_schema' mode supported by our custom GLM worker
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response_schema",
              strict: true,
              schema: jsonSchema,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GLM Worker Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("GLM returned empty content");
      }

      // Cleanup raw LLM output
      const cleanContent = sanitizeJSON(content);

      try {
        const parsed = JSON.parse(cleanContent);
        // VALDATION: If this fails, it jumps to the catch block and triggers a retry
        const validated = outputSchema.parse(parsed);
        console.log(`[GLM generateObject] Attempt ${attempt} Succeeded.`);
        return validated;
      } catch (innerError: unknown) {
        console.warn(
          `[GLM generateObject] Attempt ${attempt} failed validation.`,
        );
        lastError = innerError;
        if (innerError instanceof z.ZodError) {
          // Log specific schema mismatches to help with prompt debugging
          console.error(
            "[GLM generateObject] Zod Issues:",
            JSON.stringify(innerError.issues, null, 2),
          );
        }
      }
    } catch (outerError: unknown) {
      console.warn(
        `[GLM generateObject] Attempt ${attempt} failed request:`,
        (outerError as Error).message || outerError,
      );
      lastError = outerError;
    }

    // Exponential backoff before retry (1s, 2s)
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  console.error(
    "[GLM generateObject] All 3 attempts failed. Throwing last error.",
  );
  throw (
    lastError || new Error("Failed to generate valid object after 3 attempts")
  );
}
