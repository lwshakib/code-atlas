import { Pinecone, Index } from "@pinecone-database/pinecone";

/**
 * PINECONE SERVICE
 * 
 * Centralized service for interacting with the Pinecone vector database.
 * This class uses the singleton pattern to ensure a single client instance
 * is shared throughout the application.
 */
export class PineconeService {
  private static instance: PineconeService;
  private client: Pinecone;
  private indexName: string;

  /**
   * PRIVATE CONSTRUCTOR
   * Initializes the Pinecone client and validates configuration.
   */
  private constructor() {
    const apiKey = process.env.PINECONE_API_KEY;
    this.indexName = process.env.PINECONE_INDEX || "";

    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not set in environment variables.");
    }

    if (!this.indexName) {
      throw new Error("PINECONE_INDEX is not set in environment variables.");
    }

    // Initialize the Pinecone SDK client
    this.client = new Pinecone({
      apiKey,
    });
  }

  /**
   * GET INSTANCE
   * Returns the singleton instance of the PineconeService.
   */
  public static getInstance(): PineconeService {
    if (!PineconeService.instance) {
      PineconeService.instance = new PineconeService();
    }
    return PineconeService.instance;
  }

  /**
   * GET INDEX
   * Returns the handle for the primary codebase index.
   * 
   * @returns The Pinecone Index instance
   */
  public getIndex(): Index {
    return this.client.index(this.indexName);
  }

  /**
   * GET CLIENT
   * Provides direct access to the underlying Pinecone client for advanced operations.
   * 
   * @returns The Pinecone client instance
   */
  public getClient(): Pinecone {
    return this.client;
  }
}
