import { Embeddings } from '@langchain/core/embeddings';
import * as env from '@/lib/env';
import {
  BGE_M3_EMBEDDING_BATCH_SIZE,
  BGE_M3_MAX_TOKENS_PER_BATCH,
  CHARS_PER_TOKEN_ESTIMATE,
} from '@/lib/constants';

/**
 * Custom wrapper for Cloudflare Workers AI BGE-M3 Embeddings.
 * BGE-M3 is a Multi-Functionality, Multi-Linguality, and Multi-Granularity model.
 * It produces embeddings with 1024 dimensions.
 */
class CloudflareBgeM3Embeddings extends Embeddings {
  apiKey: string;
  workerUrl: string;

  /**
   * @param fields - Optional API key and worker URL overrides.
   */
  constructor(fields?: { apiKey?: string; workerUrl?: string }) {
    super({});
    this.apiKey = fields?.apiKey || env.CLOUDFLARE_API_KEY || '';
    this.workerUrl = fields?.workerUrl || env.BGE_M3_WORKER_URL || '';

    if (!this.apiKey) {
      throw new Error('CLOUDFLARE_API_KEY is not set');
    }
    if (!this.workerUrl) {
      throw new Error('BGE_M3_WORKER_URL is not set');
    }
  }

  /**
   * Estimate token count from a string using a conservative chars-per-token ratio.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
  }

  /**
   * Creates token-budget-aware batches that stay within the model's context limit.
   * Each batch will not exceed BGE_M3_MAX_TOKENS_PER_BATCH estimated tokens,
   * and will also respect the BGE_M3_EMBEDDING_BATCH_SIZE document count limit.
   */
  private createTokenAwareBatches(documents: string[]): string[][] {
    const maxTokens = BGE_M3_MAX_TOKENS_PER_BATCH;
    const maxDocs = BGE_M3_EMBEDDING_BATCH_SIZE;
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentTokens = 0;

    for (const doc of documents) {
      const docTokens = this.estimateTokens(doc);

      // If a single document exceeds the budget, it goes in its own batch
      if (docTokens >= maxTokens) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentTokens = 0;
        }
        batches.push([doc]);
        continue;
      }

      // Start a new batch if adding this doc would exceed limits
      if (
        currentTokens + docTokens > maxTokens ||
        currentBatch.length >= maxDocs
      ) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [];
        currentTokens = 0;
      }

      currentBatch.push(doc);
      currentTokens += docTokens;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Generates embeddings for an array of document strings.
   * Automatically batches requests using token-budget-aware batching
   * to comply with the Cloudflare model's context window limit (60k tokens).
   *
   * @param documents - Array of text strings to embed.
   * @returns A promise resolving to an array of coordinate arrays (embeddings).
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const batches = this.createTokenAwareBatches(documents);
    const results: number[][] = [];

    console.log(
      `[Embeddings] Splitting ${documents.length} documents into ${batches.length} token-aware batches`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const estimatedTokens = batch.reduce(
        (sum, doc) => sum + this.estimateTokens(doc),
        0
      );
      console.log(
        `[Embeddings] Batch ${i + 1}/${batches.length}: ${batch.length} docs, ~${estimatedTokens} estimated tokens`
      );
      const batchResult = await this._embedBatch(batch);
      results.push(...batchResult);
    }

    return results;
  }

  /**
   * Internal helper to send a single batch of documents to the Cloudflare worker.
   */
  private async _embedBatch(documents: string[]): Promise<number[][]> {
    try {
      const response = await fetch(this.workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          text: documents,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare Worker Error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      // The worker returns { data: number[][], shape: [n, 1024], ... }
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid response format from embedding worker');
      }

      return result.data;
    } catch (error) {
      console.error('Error in _embedBatch:', error);
      throw error;
    }
  }

  /**
   * Generates an embedding for a single search query or document.
   */
  async embedQuery(document: string): Promise<number[]> {
    try {
      const response = await fetch(this.workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          text: [document],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare Worker Error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('Invalid response format from embedding worker');
      }

      return result.data[0];
    } catch (error) {
      console.error('Error in embedQuery:', error);
      throw error;
    }
  }
}

/**
 * Factory function to get an embeddings client.
 * BGE-M3 default dimensionality is 1024.
 */
export const getEmbeddings = (taskType?: any, dimensionality?: number) =>
  new CloudflareBgeM3Embeddings();

/**
 * Simple helper to generate embedding for a single string.
 */
export const generateEmbeddings = async (text: string, taskType?: any) => {
  const embeddings = getEmbeddings();
  return await embeddings.embedQuery(text);
};

/**
 * Simple helper to generate embeddings for a list of strings in batch.
 */
export const generateBatchEmbeddings = async (texts: string[], taskType?: any) => {
  const embeddings = getEmbeddings();
  return await embeddings.embedDocuments(texts);
};
