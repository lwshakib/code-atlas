/**
 * NEO4J DRIVER CONFIGURATION
 *
 * This file manages the connection to our graph database.
 * Neo4j is used to store high-level code architecture, file hierarchies,
 * and semantic relationships between modules.
 */

import neo4j, { Driver } from "neo4j-driver";

// Connection credentials fetched from environment variables
const uri = process.env.NEO4J_URI;
const username = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;

// Singleton driver instance to avoid creating excessive socket connections
let driver: Driver | null = null;

/**
 * GET NEO4J DRIVER
 * Returns the existing driver instance or creates a new one if it doesn't exist.
 */
export const getNeo4jDriver = (): Driver => {
  if (!driver) {
    if (!uri || !username || !password) {
      throw new Error("Neo4j environment variables are not set");
    }
    // Initialize the driver with basic authentication
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }
  return driver;
};

/**
 * CLOSE NEO4J DRIVER
 * Ensures the connection is terminated properly, usually called on process exit.
 */
export const closeNeo4jDriver = async () => {
  if (driver) {
    await driver.close();
    driver = null;
  }
};
