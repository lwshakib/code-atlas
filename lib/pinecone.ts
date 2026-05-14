import { Pinecone, Index } from "@pinecone-database/pinecone";

/**
 * PINECONE CONFIGURATION
 *
 * Centralized library for interacting with the Pinecone vector database.
 * Uses a functional singleton pattern to ensure a single client instance.
 */

let pineconeClient: Pinecone | null = null;

/**
 * GET PINECONE CLIENT
 * Returns the existing Pinecone client instance or creates a new one.
 */
export const getPineconeClient = (): Pinecone => {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;

    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not set in environment variables.");
    }

    pineconeClient = new Pinecone({
      apiKey,
    });
  }
  return pineconeClient;
};

/**
 * GET PINECONE INDEX
 * Returns the handle for the primary codebase index.
 *
 * @returns The Pinecone Index instance
 */
export const getPineconeIndex = (): Index => {
  const client = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX;

  if (!indexName) {
    throw new Error("PINECONE_INDEX is not set in environment variables.");
  }

  return client.index(indexName);
};
