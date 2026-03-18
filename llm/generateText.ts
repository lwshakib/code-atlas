/**
 * SIMPLE TEXT GENERATION
 *
 * Provides a non-streaming interface to the GLM-4.7-Flash model.
 * Used for short, atomic tasks like summarizing a file or generating a title.
 */

import { GLM_WORKER_URL, CLOUDFLARE_API_KEY } from "@/lib/env";

/**
 * GENERATE TEXT FROM GLM
 *
 * Performs a standard POST request to the serverless LLM worker.
 *
 * @param messages - Array of message objects { role, content }
 * @returns The final text response from the assistant
 */
export async function generateTextFromGLM(
  messages: { role: string; content: string }[],
): Promise<string> {
  try {
    const response = await fetch(GLM_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
      },
      body: JSON.stringify({
        messages,
        stream: false, // Request a complete response instead of a stream
      }),
    });

    // Check for HTTP errors (e.g., 401 Unauthorized or 500 Worker Error)
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM Worker Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract the content from the standard OpenAI-compatible response format
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("[GLM generateText] Error:", error);
    throw error;
  }
}
