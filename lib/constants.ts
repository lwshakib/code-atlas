/**
 * GLOBAL CONSTANTS
 *
 * Centralized configuration for indexing batches, LLM token limits,
 * and embedding heuristics. Tuned for Cloudflare Workers & BGE-M3 models.
 */

// Number of concurrent documents to process in a single worker batch
export const BGE_M3_EMBEDDING_BATCH_SIZE = 10;

// Number of files to pull from GitHub and queue for indexing in one pass
export const INDEXING_BATCH_SIZE = 100;

/**
 * CLOUDFLARE EMBEDDING LIMITS
 * The BGE-M3 model on Cloudflare has a 60,000 token limit per batch request.
 * We set our limit to 50,000 for a safety buffer against tokenization overhead.
 */
export const BGE_M3_MAX_TOKENS_PER_BATCH = 50_000;

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
