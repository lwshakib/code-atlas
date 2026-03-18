/**
 * ENVIRONMENT CONFIGURATION
 * 
 * Centralized export for critical service URLs and API keys used by the LLM workers.
 */

// URL of the GLM (Graph Large Model) worker for architectural analysis
export const GLM_WORKER_URL = process.env.GLM_WORKER_URL!;

// Cloudflare API key used for various serverless worker calls
export const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY!;

// URL of the worker dedicated to BGE-M3 embedding generation
export const BGE_M3_WORKER_URL = process.env.BGE_M3_WORKER_URL!;
