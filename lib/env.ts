import { z } from "zod";

const envSchema = z.object({
  CLOUDFLARE_AI_GATEWAY_API_KEY: z.string().min(1, "CLOUDFLARE_AI_GATEWAY_API_KEY is required"),
  CLOUDFLARE_AI_GATEWAY_ENDPOINT: z.string().url("CLOUDFLARE_AI_GATEWAY_ENDPOINT must be a valid URL"),
  GITHUB_CLIENT_ID: z.string().min(1, "GITHUB_CLIENT_ID is required"),
  GITHUB_CLIENT_SECRET: z.string().min(1, "GITHUB_CLIENT_SECRET is required"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables");
}

export const env = _env.data;

export const CLOUDFLARE_AI_GATEWAY_API_KEY = env.CLOUDFLARE_AI_GATEWAY_API_KEY;
export const CLOUDFLARE_AI_GATEWAY_ENDPOINT = env.CLOUDFLARE_AI_GATEWAY_ENDPOINT;
