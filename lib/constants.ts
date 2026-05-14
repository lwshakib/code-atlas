/**
 * GLOBAL CONSTANTS
 *
 * Centralized configuration for indexing batches, rate limits,
 * and ingestion heuristics.
 */

// Number of files to process in a single ingestion batch (summaries)
export const INDEXING_BATCH_SIZE = 50;

// Number of files to include in a single batch summarization request
export const SUMMARIZATION_BATCH_SIZE = 50;

// Mandatory wait time between batches to respect API rate limits (e.g., 30k TPM)
export const BATCH_WAIT_TIME_MS = 60_000;

// Maximum tokens allowed per embedding request
export const MAX_TOKENS_PER_BATCH = 30_000;

/**
 * TOKEN ESTIMATION
 * Code often has a high ratio of tokens to characters compared to natural language.
 * We use 1.3 as a conservative heuristic for character-to-token conversion.
 */
export const CHARS_PER_TOKEN_ESTIMATE = 1.3;

/**
 * DOCUMENT CHUNK SIZE
 * Each individual document (file content) sent for embedding is capped to avoid
 * exceeding the model's context window per entry.
 */
export const MAX_EMBEDDING_TEXT_LENGTH = 3000;
