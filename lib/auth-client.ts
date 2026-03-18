/**
 * CLIENT-SIDE AUTHENTICATION UTILITIES
 * 
 * Provides the authClient used for managing sessions, sign-ups, and log-outs 
 * within React components. Integrated with the server-side Better Auth setup.
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  /**
   * BASE URL
   * tells the client where to send authentication requests (sign-in, checkout, etc).
   */
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
});

