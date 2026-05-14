/**
 * ENVIRONMENT CONFIGURATION
 *
 * Centralized export for critical service URLs and API keys used by the LLM workers.
 */

// Cloudflare AI Gateway API Key
export const CLOUDFLARE_AI_GATEWAY_API_KEY =
  process.env.CLOUDFLARE_AI_GATEWAY_API_KEY!;

// Cloudflare AI Gateway Endpoint
export const CLOUDFLARE_AI_GATEWAY_ENDPOINT =
  process.env.CLOUDFLARE_AI_GATEWAY_ENDPOINT!;
