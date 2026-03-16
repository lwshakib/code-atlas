import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from './prisma';

/**
 * Server-side Better Auth configuration.
 * Configures database adapters and authentication methods.
 */
export const auth = betterAuth({
  /**
   * Database adapter for Prisma.
   * Connects Better Auth to the PostgreSQL database for storing users, sessions, and accounts.
   */
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  /**
   * Social Authentication Providers.
   * Configures OAuth2 flows for platforms like GitHub.
   */
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
});
