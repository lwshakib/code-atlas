/* eslint-disable @typescript-eslint/no-explicit-any */
import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime/middleware";

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "code-atlas",
  middleware: [realtimeMiddleware() as any],
});
