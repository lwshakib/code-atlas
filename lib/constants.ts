export const BGE_M3_EMBEDDING_BATCH_SIZE = 10;
export const INDEXING_BATCH_SIZE = 100;

// Max tokens to send per Cloudflare embedding batch (model limit is 60k, we budget 50k for safety)
export const BGE_M3_MAX_TOKENS_PER_BATCH = 50_000;

// Rough chars-per-token estimate for code (conservative)
export const CHARS_PER_TOKEN_ESTIMATE = 1.3;

// Max characters per document text sent for embedding
export const MAX_EMBEDDING_TEXT_LENGTH = 3000;
