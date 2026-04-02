import { Embeddings } from '@langchain/core/embeddings';
import * as env from '@/lib/env';
import { 
  BGE_M3_EMBEDDING_BATCH_SIZE,
  EMBEDDING_MODEL_ID,
  CHAT_MODEL_ID 
} from '@/lib/constants';

/**
 * AIService Class
 * Centralizes all AI-related operations.
 */
export class AIService extends Embeddings {
  private apiKey: string;
  private gatewayUrl: string;

  constructor() {
    super({});
    this.apiKey = env.CLOUDFLARE_AI_GATEWAY_API_KEY!;
    this.gatewayUrl = env.CLOUDFLARE_AI_GATEWAY_ENDPOINT!;

    if (!this.apiKey || !this.gatewayUrl) {
      throw new Error(
        'AIService Configuration error: API Key and Endpoint must be defined.'
      );
    }
  }

  public getGatewayUrl() {
    return this.gatewayUrl;
  }

  /**
   * SSE Text Streaming with Tool Calling
   */
  async streamText(messages: any[], options?: {
    tools?: any[];
    codebaseId?: string;
    executeTool?: (name: string, args: Record<string, unknown>, codebaseId: string, signal?: AbortSignal) => Promise<any>;
    abortSignal?: AbortSignal;
    onFinish?: (result: { content: string; toolInvocations: any[] }) => Promise<void>;
  }) {
    const { tools, codebaseId, executeTool, onFinish, abortSignal } = options || {};

    const url = this.gatewayUrl;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (codebaseId) {
      headers['x-session-affinity'] = codebaseId;
    }

    const history = [...messages];

    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let finalContent = '';
        let finalReasoning = '';
        const finalToolInvocations: any[] = [];
        const sendEvent = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          const currentHistory: any[] = [...history];
          let toolCallsAttempt = 0;
          while (toolCallsAttempt < 10) {
            if (abortSignal?.aborted) break;
            const response = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify({ model: CHAT_MODEL_ID, messages: currentHistory, tools, stream: true }),
              signal: abortSignal,
            });

            if (!response.ok) {
              sendEvent({ type: 'error', message: `Model error: ${await response.text()}` });
              break;
            }

            const reader = response.body?.getReader();
            if (!reader) break;

            let assistantContent = '';
            let toolCalls: any[] = [];
            const textDecoder = new TextDecoder();
            let lineBuffer = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                lineBuffer += textDecoder.decode(value, { stream: true });
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                    try {
                      const data = JSON.parse(trimmed.slice(6));
                      const delta = data.choices?.[0]?.delta;
                      if (!delta) continue;
                      if (delta.reasoning_content) {
                        finalReasoning += delta.reasoning_content;
                        sendEvent({ type: 'reasoning', content: delta.reasoning_content });
                      }
                      if (delta.content) {
                        assistantContent += delta.content;
                        finalContent += delta.content;
                        sendEvent({ type: 'text', content: delta.content });
                      }
                      if (delta.tool_calls) {
                        delta.tool_calls.forEach((tc: any) => {
                          const idx = tc.index;
                          if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id, type: 'function', function: { name: tc.function.name, arguments: '' } };
                          if (tc.function.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                        });
                      }
                    } catch (e) {
                      // ignore parse errors for partial chunks
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }

            toolCalls = toolCalls.filter(Boolean);
            currentHistory.push({ 
              role: 'assistant', 
              content: assistantContent || (null as any), 
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              tool_call_id: undefined 
            });

            if (toolCalls.length > 0) {
              toolCallsAttempt++;
              for (const tc of toolCalls) {
                const toolName = tc.function.name;
                const args = JSON.parse(tc.function.arguments || '{}');
                sendEvent({ type: 'tool', id: tc.id, tool: toolName, status: 'calling' });

                if (executeTool) {
                  try {
                    const result = await executeTool(toolName, args, codebaseId || '', abortSignal);
                    sendEvent({ type: 'tool', id: tc.id, tool: toolName, status: 'success', result });
                    finalToolInvocations.push({ type: 'tool', id: tc.id, tool: toolName, result });
                    currentHistory.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result), tool_calls: undefined });
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    sendEvent({ type: 'tool', id: tc.id, tool: toolName, status: 'error', result: msg });
                    finalToolInvocations.push({ type: 'tool', id: tc.id, tool: toolName, result: `Error: ${msg}` });
                    currentHistory.push({ role: 'tool', tool_call_id: tc.id, content: `Error: ${msg}`, tool_calls: undefined });
                  }
                } else {
                  sendEvent({ type: 'tool', id: tc.id, tool: toolName, status: 'error', result: 'Tool executor missing' });
                  currentHistory.push({ role: 'tool', tool_call_id: tc.id, content: 'Error: Tool not found', tool_calls: undefined });
                }
              }
            } else break;
          }
        } catch (err) {
          if (!(err instanceof Error && err.name === 'AbortError')) {
            sendEvent({ type: 'error', message: 'Internal server error' });
            controller.error(err);
          }
        } finally {
          if (onFinish && (finalContent || finalReasoning || finalToolInvocations.length > 0)) {
            await onFinish({ content: finalContent, reasoning: finalReasoning || undefined, toolInvocations: finalToolInvocations } as any);
          }
          controller.close();
        }
      },
    });
  }

  /**
   * Non-streaming Text Generation
   */
  async generateText(
    messages: any[],
    options?: { temperature?: number; max_tokens?: number; codebaseId?: string }
  ): Promise<string> {
    const { temperature, max_tokens, codebaseId } = options || {};

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (codebaseId) {
      headers['x-session-affinity'] = codebaseId;
    }

    const response = await fetch(this.gatewayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: CHAT_MODEL_ID,
        messages,
        temperature,
        max_tokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${await response.text()}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  }

  /**
   * Structured JSON Generation
   */
  async generateObject<T>(
    messages: any[],
    outputSchema: any,
    options?: { codebaseId?: string }
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (options?.codebaseId) {
      headers['x-session-affinity'] = options.codebaseId;
    }

    const response = await fetch(this.gatewayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: CHAT_MODEL_ID,
        messages,
        response_format: { type: 'json_object' },
      }),
    });
    
    if (!response.ok) {
        throw new Error(`AI Gateway error: ${await response.text()}`);
    }

    const result = await response.json();
    
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(`Failed to generate object: No content in response. ${JSON.stringify(result)}`);
    }

    try {
      return JSON.parse(content);
    } catch (e) {
      console.error('[AIService] JSON Parse Error. Content:', content);
      throw new Error(`Model returned invalid JSON: ${content.slice(0, 100)}...`);
    }
  }

  /**
   * Embeddings (BGE-M3)
   */
  async embedQuery(text: string): Promise<number[]> {
    const embedUrl = this.gatewayUrl;
    const response = await fetch(embedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      // some workers require { text: string[] }, some require full payload
      body: JSON.stringify({ 
        model: EMBEDDING_MODEL_ID, 
        text: [text],
        truncate_inputs: true
      }),
    });
    
    if (!response.ok) {
        throw new Error(`Embedding Error: ${await response.text()}`);
    }
    
    const result = await response.json();
    return result.data[0];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embedUrl = this.gatewayUrl;
    const batchSize = BGE_M3_EMBEDDING_BATCH_SIZE;
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await fetch(embedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ 
          model: EMBEDDING_MODEL_ID, 
          text: batch,
          truncate_inputs: true
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Embedding Batch Error: ${await response.text()}`);
      }
      
      const result = await response.json();
      if (result.data) {
        results.push(...result.data);
      }
    }
    
    return results;
  }
}

export const aiService = new AIService();
