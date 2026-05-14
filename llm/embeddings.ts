import { client } from "./client";
import { EMBEDDING_MODEL_ID, EMBEDDING_DIMENSIONALITY } from "./constants";

/**
 * EMBEDDING UTILITIES
 *
 * Functions to generate embeddings using Gemini Embedding 2.
 * Includes task-specific formatting as recommended in doc.md.
 */

/**
 * EMBED QUERY
 * Used for semantic search queries.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL_ID,
    contents: `task: search result | query: ${query}`,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONALITY,
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values) {
    throw new Error("Failed to generate query embedding");
  }

  return values;
}

/**
 * EMBED DOCUMENT
 * Used for indexing files/snippets.
 */
export async function embedDocument(
  content: string,
  title: string = "none",
): Promise<number[]> {
  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL_ID,
    contents: `title: ${title} | text: ${content}`,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONALITY,
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values) {
    throw new Error("Failed to generate document embedding");
  }

  return values;
}
