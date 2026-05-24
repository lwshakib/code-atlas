/**
 * SERVER-SIDE AUTHENTICATION CONFIGURATION
 *
 * This file initializes Better Auth, our authentication framework.
 * It connects to our PostgreSQL database via Prisma and handles OAuth2 flows.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { env } from "./env";

export const auth = betterAuth({
  /**
   * DATABASE ADAPTER
   *
   * We use the Prisma adapter to tell Better Auth how to store its internal tables
   * (users, sessions, accounts, etc.) inside our existing PostgreSQL schema.
   */
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  /**
   * SOCIAL PROVIDERS
   *
   * Enables 'Login with GitHub'. The client ID and secret are pulled from
   * environment variables for security.
   */
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
});
