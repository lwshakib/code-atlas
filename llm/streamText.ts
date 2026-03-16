import { GLM_WORKER_URL, CLOUDFLARE_API_KEY } from "@/lib/env";

/**
 * Creates a readable stream from the GLM-4.7-Flash worker.
 * 
 * @param messages - Array of message objects { role, content }
 * @param signal - AbortSignal to cancel the request
 * @returns A ReadableStream that emits text chunks
 */
export async function streamTextFromGLM(messages: { role: string; content: string }[], signal?: AbortSignal): Promise<ReadableStream> {
  const response = await fetch(GLM_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`
    },
    body: JSON.stringify({
      messages,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GLM Worker Error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      if (!reader) {
        controller.close();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch (e) {
                console.error("Error parsing GLM stream chunk:", e, data);
              }
            }
          }
        }
      } catch (error: unknown) {
        if ((error as Error).name === "AbortError") {
          console.log("[GLM Stream] Aborted");
        } else {
          controller.error(error);
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    }
  });
}
