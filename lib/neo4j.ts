import neo4j, { Driver } from 'neo4j-driver';

const uri = process.env.NEO4J_URI;
const username = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;

let driver: Driver | null = null;

export const getNeo4jDriver = (): Driver => {
  if (!driver) {
    if (!uri || !username || !password) {
      throw new Error('Neo4j environment variables are not set');
    }
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }
  return driver;
};

export const closeNeo4jDriver = async () => {
  if (driver) {
    await driver.close();
    driver = null;
  }
};
