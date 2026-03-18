import { z } from "zod";
import { GLM_WORKER_URL, CLOUDFLARE_API_KEY } from "@/lib/env";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Sanitizes JSON content by stripping markdown fences and non-JSON noise.
 */
function sanitizeJSON(content: string): string {
  let clean = content.trim();
  
  // 1. Try to find the outermost braces {}
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    // Check if there's a JSON markdown block that contains these braces
    // (Optional but good if the LLM provided valid JSON inside a fenced block)
    const jsonMatch = clean.match(/```json\n?([\s\S]*?)\n?```/i);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }

    // Otherwise, just extract everything from the first { to the last }
    return clean.substring(firstBrace, lastBrace + 1);
  }

  // 2. Fallback: Strip markdown fences if present
  if (clean.includes("```")) {
    const match = clean.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (match) {
      return match[1].trim();
    }
  }

  return clean;
}

/**
 * Generates a structured object using the GLM-4.7-Flash worker with JSON schema mode.
 * 
 * @param messages - Array of message objects { role, content }
 * @param outputSchema - Zod schema for the expected object
 * @returns The generated and parsed object
 */
export async function generateObjectFromGLM<T>({
  messages,
  outputSchema
}: {
  messages: { role: string; content: string }[];
  outputSchema: z.ZodSchema<T>;
}): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = zodToJsonSchema(outputSchema as any);
  const schemaString = JSON.stringify(jsonSchema, null, 2);

  // Inject schema instructions into the first system message if it exists, or create one.
  // This avoids having multiple competing system messages.
  const enhancedMessages = [...messages];
  const schemaInstruction = `\n\nCRITICAL: You MUST return a single JSON object that strictly adheres to this JSON Schema:\n${schemaString}\n\nDo not include any other text, explanations, or markdown outside the JSON object.`;

  if (enhancedMessages.length > 0 && enhancedMessages[0].role === "system") {
    enhancedMessages[0] = {
      ...enhancedMessages[0],
      content: enhancedMessages[0].content + schemaInstruction
    };
  } else {
    enhancedMessages.unshift({
      role: "system",
      content: "Complete the following request." + schemaInstruction
    });
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[GLM generateObject] Initiating Attempt ${attempt}...`);
      
      const response = await fetch(GLM_WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`
        },
        body: JSON.stringify({
          messages: enhancedMessages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response_schema",
              strict: true,
              schema: jsonSchema
            }
          }
        })
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

      const cleanContent = sanitizeJSON(content);

      try {
        const parsed = JSON.parse(cleanContent);
        // Successful parse and Zod validation
        const validated = outputSchema.parse(parsed);
        console.log(`[GLM generateObject] Attempt ${attempt} Succeeded.`);
        return validated;
      } catch (innerError: unknown) {
        console.warn(`[GLM generateObject] Attempt ${attempt} failed validation.`);
        console.log(`[GLM generateObject] RAW CONTENT:`, content);
        lastError = innerError;
        // Optimization: if it's a ZodError, we can see exactly what failed
        if (innerError instanceof z.ZodError) {
          console.error("[GLM generateObject] Zod Issues:", JSON.stringify(innerError.issues, null, 2));
        }
      }
    } catch (outerError: unknown) {
      console.warn(`[GLM generateObject] Attempt ${attempt} failed request:`, (outerError as Error).message || outerError);
      lastError = outerError;
    }

    // Wait slightly before retry (optional, but decent for rate limits)
    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  console.error("[GLM generateObject] All 3 attempts failed. Throwing last error.");
  throw lastError || new Error("Failed to generate valid object after 3 attempts");
}
