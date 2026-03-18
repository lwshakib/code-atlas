/**
 * PINECONE CLIENT CONFIGURATION
 * 
 * This file manages the connection to our vector database.
 * Pinecone stores semantic embeddings of code files, enabling RAG 
 * (Retrieval-Augmented Generation) based search.
 */

import { Pinecone } from '@pinecone-database/pinecone';

// API Configuration retrieved from environment variables
const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.PINECONE_INDEX;

// Singleton client to maintain persistent connections
let pinecone: Pinecone | null = null;

/**
 * GET PINECONE CLIENT
 * Lazy-loads the Pinecone SDK client on the first request.
 */
export const getPineconeClient = (): Pinecone => {
  if (!pinecone) {
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is not set');
    }
    pinecone = new Pinecone({
      apiKey,
    });
  }
  return pinecone;
};

/**
 * GET PINECONE INDEX
 * Returns the specific index handle used for storing/querying data.
 */
export const getPineconeIndex = () => {
  const client = getPineconeClient();
  if (!indexName) {
    throw new Error('PINECONE_INDEX is not set');
  }
  return client.index(indexName);
};

