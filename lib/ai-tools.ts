import { getPineconeIndex } from "./pinecone";
import { getNeo4jDriver } from "./neo4j";
import { generateEmbeddings } from "@/llm/embeddings";
import prisma from "./prisma";

export const aiTools = [
  {
    type: "function",
    function: {
      name: "search_codebase",
      description: "Search for relevant code snippets in the codebase using semantic vector search. Returns file paths and short snippets. Use this when you don't know the exact file path or are looking for specific functionality.",
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
      name: "get_file_content",
      description: "Retrieve the full content of a specific file. Use this after you have a file path from search_codebase or list_files and need to see the complete logic.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The file path relative to the repository root (e.g., 'app/page.tsx')." }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all files and directory structure in the codebase. Use this to understand the project layout, routing structure (e.g., app directory), or to find specific configuration files.",
      parameters: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Optional directory to list (e.g., 'app'). If omitted, lists the top-level structure." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_graph_relations",
      description: "Query relationships between files/modules in the codebase using Cypher on Neo4j. Useful for complex architectural analysis like finding all dependencies of a module.",
      parameters: {
        type: "object",
        properties: {
          cypher: { type: "string", description: "The Cypher query to run." }
        },
        required: ["cypher"]
      }
    }
  }
];

export async function executeTool(name: string, args: any, codebaseId: string, signal?: AbortSignal) {
  if (name === "search_codebase") {
    const { query } = args;
    console.log(`[Tool: search_codebase] Query: "${query}" | Codebase: ${codebaseId}`);
    const embedding = await generateEmbeddings(query, signal);
    
    signal?.throwIfAborted();
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

  if (name === "get_file_content") {
    const { path } = args;
    console.log(`[Tool: get_file_content] Path: "${path}" | Codebase: ${codebaseId}`);
    
    signal?.throwIfAborted();
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
      const result = await session.executeRead(tx => 
        tx.run(
          `
          MATCH (f:File {path: $path, codebaseId: $codebaseId})
          RETURN f.content as content
          `, 
          { codebaseId, path }
        )
      );

      if (result.records.length > 0) {
        return { path, content: result.records[0].get('content') };
      }
      
      return { error: "File not found in the indexed database." };
    } catch (err: any) {
      console.error(`Error fetching file from Neo4j ${path}:`, err);
      return { error: `Failed to fetch file content from database: ${err.message}` };
    } finally {
      await session.close();
    }
  }

  if (name === "list_files") {
    const { directory = "" } = args;
    console.log(`[Tool: list_files] Dir: "${directory}" | Codebase: ${codebaseId}`);
    
    signal?.throwIfAborted();
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
      const result = await session.executeRead(tx => 
        tx.run(
          `
          MATCH (f:File {codebaseId: $codebaseId})
          WHERE f.path STARTS WITH $prefix
          RETURN f.path as path LIMIT 200
          `, 
          { codebaseId, prefix: directory ? (directory.endsWith('/') ? directory : directory + '/') : "" }
        )
      );
      
      const paths = result.records.map(r => r.get('path'));
      return { paths, count: paths.length };
    } finally {
      await session.close();
    }
  }

  if (name === "query_graph_relations") {
    const { cypher } = args;
    console.log(`[Tool: query_graph_relations] Cypher: "${cypher}" | Codebase: ${codebaseId}`);
    
    signal?.throwIfAborted();
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

