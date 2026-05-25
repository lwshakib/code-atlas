// Cloudflare AI Gateway API Key
export const CLOUDFLARE_AI_GATEWAY_API_KEY =
  process.env.CLOUDFLARE_AI_GATEWAY_API_KEY!;

// Cloudflare AI Gateway Endpoint
export const CLOUDFLARE_AI_GATEWAY_ENDPOINT =
  process.env.CLOUDFLARE_AI_GATEWAY_ENDPOINT!;

// Neo4j Configuration
export const NEO4J_URI = process.env.NEO4J_URI;
export const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
export const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

// Pinecone Configuration
export const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
export const PINECONE_INDEX = process.env.PINECONE_INDEX;

/**
 * Validates mandatory environment variables.
 * We only perform this check when we're NOT building the app,
 * or when we know we're in a runtime environment.
 */
export const checkEnv = () => {
  if (process.env.NODE_ENV === "test") return;
  // Skip during build time if we're just checking types or generating assets
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
    throw new Error(
      "Missing required Neo4j environment variables (NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD)",
    );
  }

  if (!PINECONE_API_KEY) {
    throw new Error(
      "Missing required Pinecone environment variable: PINECONE_API_KEY",
    );
  }

  if (!PINECONE_INDEX) {
    throw new Error(
      "Missing required Pinecone environment variable: PINECONE_INDEX",
    );
  }
};
