import "dotenv/config";
import neo4j from "neo4j-driver";
import { Pinecone } from "@pinecone-database/pinecone";

async function resetDatabases() {
  console.log("🚀 Starting database reset...");

  // 1. Reset Neo4j
  const neo4jUri = process.env.NEO4J_URI;
  const neo4jUser = process.env.NEO4J_USERNAME;
  const neo4jPass = process.env.NEO4J_PASSWORD;

  if (neo4jUri && neo4jUser && neo4jPass) {
    console.log("🔗 Connecting to Neo4j...");
    const driver = neo4j.driver(
      neo4jUri,
      neo4j.auth.basic(neo4jUser, neo4jPass),
    );
    const session = driver.session();
    try {
      await session.executeWrite((tx) => tx.run("MATCH (n) DETACH DELETE n"));
      console.log("✅ Neo4j: All nodes and relationships deleted.");
    } catch (err) {
      console.error("❌ Neo4j Reset Error:", err);
    } finally {
      await session.close();
      await driver.close();
    }
  } else {
    console.warn(
      "⚠️ Neo4j environment variables missing. Skipping Neo4j reset.",
    );
  }

  // 2. Reset Pinecone
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeIndexName = process.env.PINECONE_INDEX;

  if (pineconeApiKey && pineconeIndexName) {
    console.log("🔗 Connecting to Pinecone...");
    const pc = new Pinecone({ apiKey: pineconeApiKey });
    try {
      const index = pc.index(pineconeIndexName);
      await index.deleteAll();
      console.log("✅ Pinecone: All vectors deleted from index.");
    } catch (err) {
      console.error("❌ Pinecone Reset Error:", err);
    }
  } else {
    console.warn(
      "⚠️ Pinecone environment variables missing. Skipping Pinecone reset.",
    );
  }

  console.log("🎉 Database reset complete.");
}

resetDatabases().catch(console.error);
