/**
 * BETTER AUTH ROUTE HANDLER
 *
 * This file serves as the main entry point for all authentication-related requests.
 * Better Auth uses a catch-all route ([...all]) to handle various auth flows
 * such as sign-in, sign-up, sign-out, and social provider callbacks (e.g., GitHub).
 */

import { auth } from "@/lib/auth"; // Import the server-side Better Auth configuration
import { toNextJsHandler } from "better-auth/next-js"; // Utility to convert Better Auth logic into Next.js Route Handlers

/**
 * Export GET and POST handlers.
 * Better Auth internally routes requests based on the URL path (e.g., /api/auth/signin).
 * toNextJsHandler(auth) returns an object with GET and POST properties that handle
 * the underlying authentication logic, database interactions, and session management.
 */
export const { POST, GET } = toNextJsHandler(auth);
