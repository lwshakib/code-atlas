import { getPineconeIndex } from "./pinecone";
import { getNeo4jDriver } from "./neo4j";
import { generateEmbeddings } from "@/llm/embeddings";
import prisma from "./prisma";

export const aiTools = [
  {
    type: "function",
    function: {
      name: "search_codebase",
      description: "Search for relevant code snippets in the codebase using natural language. Returns the most relevant file paths and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The natural language query to search for code." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_graph_relations",
      description: "Query relationships between files/modules in the codebase using Cypher. Useful for understanding architecture and dependencies. The codebase node has the id provided in the context.",
      parameters: {
        type: "object",
        properties: {
          cypher: { type: "string", description: "The Cypher query to run on the Neo4j graph." }
        },
        required: ["cypher"]
      }
    }
  }
];

export async function executeTool(name: string, args: any, codebaseId: string) {
  if (name === "search_codebase") {
    const { query } = args;
    console.log(`[Tool: search_codebase] Query: "${query}" | Codebase: ${codebaseId}`);
    const embedding = await generateEmbeddings(query);
    const index = getPineconeIndex();
    const result = await index.query({
      vector: embedding,
      topK: 5,
      filter: { codebaseId: { $eq: codebaseId } },
      includeMetadata: true
    });
    console.log(`[Tool: search_codebase] Found ${result.matches.length} matches in Pinecone`);
    return result.matches.map(m => ({
      path: m.metadata?.path,
      snippet: m.metadata?.contentSnippet,
      score: m.score
    }));
  }

  if (name === "query_graph_relations") {
    const { cypher } = args;
    console.log(`[Tool: query_graph_relations] Cypher: "${cypher}" | Codebase: ${codebaseId}`);
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
      const result = await session.executeRead(tx => tx.run(cypher, { codebaseId }));
      console.log(`[Tool: query_graph_relations] Returned ${result.records.length} records from Neo4j`);
      return result.records.map(r => r.toObject());
    } finally {
      await session.close();
    }
  }

  throw new Error(`Tool ${name} not found`);
}

