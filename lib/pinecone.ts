import { Pinecone, Index } from "@pinecone-database/pinecone";
import { PINECONE_API_KEY, PINECONE_INDEX, checkEnv } from "./env";

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
    checkEnv();
    pineconeClient = new Pinecone({
      apiKey: PINECONE_API_KEY!,
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
  return client.index(PINECONE_INDEX!);
};
