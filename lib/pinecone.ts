import { Pinecone } from '@pinecone-database/pinecone';

const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.PINECONE_INDEX;

let pinecone: Pinecone | null = null;

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

export const getPineconeIndex = () => {
  const client = getPineconeClient();
  if (!indexName) {
    throw new Error('PINECONE_INDEX is not set');
  }
  return client.index(indexName);
};
