/**
 * EMBEDDING GENERATION UTILITIES
 *
 * This file handles converting text into vector embeddings using the BGE-M3 model
 * hosted on Cloudflare Workers. It includes complex "token-aware batching"
 * to respect the model's strict context window limits.
 */

import { Embeddings } from "@langchain/core/embeddings";
import * as env from "@/lib/env";
import {
  BGE_M3_EMBEDDING_BATCH_SIZE,
  BGE_M3_MAX_TOKENS_PER_BATCH,
  CHARS_PER_TOKEN_ESTIMATE,
} from "@/lib/constants";

/**
 * CLOUDFLARE BGE-M3 EMBEDDINGS CLASS
 *
 * A custom LangChain-compatible wrapper for our serverless embedding provider.
 * Dimensionality: 1024.
 */
class CloudflareBgeM3Embeddings extends Embeddings {
  apiKey: string;
  workerUrl: string;

  /**
   * CONSTRUCTOR
   * Initializes the credentials from environment variables.
   */
  constructor(fields?: { apiKey?: string; workerUrl?: string }) {
    super({});
    this.apiKey = fields?.apiKey || env.CLOUDFLARE_API_KEY || "";
    this.workerUrl = fields?.workerUrl || env.BGE_M3_WORKER_URL || "";

    if (!this.apiKey) {
      throw new Error("CLOUDFLARE_API_KEY is not set");
    }
    if (!this.workerUrl) {
      throw new Error("BGE_M3_WORKER_URL is not set");
    }
  }

  /**
   * ESTIMATE TOKENS
   * Heuristic used to guess the token count before sending to the model.
   * Based on CHARS_PER_TOKEN_ESTIMATE defined in constants.ts.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
  }

  /**
   * CREATE TOKEN-AWARE BATCHES
   *
   * CRITICAL LOGIC: Cloudflare's BGE-M3 worker has a limit of ~60k tokens per request.
   * If we send too many documents or too much text at once, the API will fail.
   * This function packs documents into batches that stay under both 'max dots'
   * and 'max tokens' safety thresholds.
   */
  private createTokenAwareBatches(documents: string[]): string[][] {
    const maxTokens = BGE_M3_MAX_TOKENS_PER_BATCH; // e.g., 50,000
    const maxDocs = BGE_M3_EMBEDDING_BATCH_SIZE; // e.g., 10
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentTokens = 0;

    for (const doc of documents) {
      const docTokens = this.estimateTokens(doc);

      // SCENARIO 1: A single massive document exceeds the entire batch budget
      if (docTokens >= maxTokens) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch); // Flush existing batch
          currentBatch = [];
          currentTokens = 0;
        }
        batches.push([doc]); // Put the giant doc in its own isolated batch
        continue;
      }

      // SCENARIO 2: Adding this doc would break the current batch limit
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

      // STANDARD CASE: Add to current working batch
      currentBatch.push(doc);
      currentTokens += docTokens;
    }

    // Final Flush
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * EMBED DOCUMENTS (Array Interface)
   * Main entry point for the indexing pipeline.
   */
  async embedDocuments(
    documents: string[],
    signal?: AbortSignal,
  ): Promise<number[][]> {
    const batches = this.createTokenAwareBatches(documents);
    const results: number[][] = [];

    console.log(
      `[Embeddings] Splitting ${documents.length} documents into ${batches.length} token-aware batches`,
    );

    // Process each safety-batch sequentially
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const estimatedTokens = batch.reduce(
        (sum, doc) => sum + this.estimateTokens(doc),
        0,
      );
      console.log(
        `[Embeddings] Batch ${i + 1}/${batches.length}: ${batch.length} docs, ~${estimatedTokens} estimated tokens`,
      );
      const batchResult = await this._embedBatch(batch, signal);
      results.push(...batchResult);
    }

    return results;
  }

  /**
   * _EMBED BATCH (Internal HTTP Request)
   * Sends the actual POST request to the Cloudflare Worker.
   */
  private async _embedBatch(
    documents: string[],
    signal?: AbortSignal,
  ): Promise<number[][]> {
    try {
      const response = await fetch(this.workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Bearer token authentication required for our custom workers
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          text: documents, // Worker expects an array of strings
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudflare Worker Error (${response.status}): ${errorText}`,
        );
      }

      const result = await response.json();

      // The BGE-M3 worker returns coordinate arrays (1024 floats)
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error("Invalid response format from embedding worker");
      }

      return result.data;
    } catch (error) {
      console.error("Error in _embedBatch:", error);
      throw error;
    }
  }

  /**
   * EMBED QUERY (Single Item Interface)
   * Used for user search queries where only one string needs processing.
   */
  async embedQuery(document: string, signal?: AbortSignal): Promise<number[]> {
    try {
      const response = await fetch(this.workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          text: [document],
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudflare Worker Error (${response.status}): ${errorText}`,
        );
      }

      const result = await response.json();

      if (
        !result.data ||
        !Array.isArray(result.data) ||
        result.data.length === 0
      ) {
        throw new Error("Invalid response format from embedding worker");
      }

      return result.data[0];
    } catch (error) {
      console.error("Error in embedQuery:", error);
      throw error;
    }
  }
}

/**
 * EXPORTS & FACTORIES
 */
export const getEmbeddings = () => new CloudflareBgeM3Embeddings();

export const generateEmbeddings = async (
  text: string,
  signal?: AbortSignal,
) => {
  const embeddings = getEmbeddings();
  return await embeddings.embedQuery(text, signal);
};

export const generateBatchEmbeddings = async (
  texts: string[],
  signal?: AbortSignal,
) => {
  const embeddings = getEmbeddings();
  return await embeddings.embedDocuments(texts, signal);
};
