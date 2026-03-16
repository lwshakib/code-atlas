import { GLM_WORKER_URL, CLOUDFLARE_API_KEY } from "@/lib/env";

/**
 * Generates text using the GLM-4.7-Flash worker.
 * 
 * @param messages - Array of message objects { role, content }
 * @returns The generated text response
 */
export async function generateTextFromGLM(messages: { role: string; content: string }[]): Promise<string> {
  try {
    const response = await fetch(GLM_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`
      },
      body: JSON.stringify({
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM Worker Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("[GLM generateText] Error:", error);
    throw error;
  }
}
