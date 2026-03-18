/**
 * INNGEST API ROUTE
 *
 * This file serves as the communication bridge between Inngest (the background job orchestrator)
 * and our Next.js application. Inngest calls this endpoint to trigger and manage functions.
 */

import { serve } from "inngest/next"; // Next.js specific adapter for Inngest
import { inngest } from "../../../inngest/client"; // The Inngest client configuration
import { indexCodebase } from "../../../inngest/functions"; // The actual background job logic

/**
 * Configure and export the GET, POST, and PUT handlers.
 * - GET: Used by Inngest to 'introspect' which functions are available.
 * - POST: Used by Inngest to trigger a specific function (e.g., when 'codebase/index.start' is sent).
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    indexCodebase, // Register the codebase indexing function
  ],
});
