import { GoogleGenAI } from "@google/genai";

/**
 * GOOGLE GENAI CLIENT
 *
 * Initializes the client using the GOOGLE_API_KEY from environment variables.
 */

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.warn("GOOGLE_API_KEY is not set. AI features will not work.");
}

export const client = new GoogleGenAI({
  apiKey: apiKey || "",
});
