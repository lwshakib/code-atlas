import { channel, topic } from "@inngest/realtime";
import { z } from "zod";

/**
 * Realtime channel for codebase-specific updates.
 * Channel name format: codebase:{codebaseId}
 */
export const codebaseChannel = channel((codebaseId: string) => `codebase:${codebaseId}`)
  .addTopic(
    topic("status").schema(
      z.object({
        status: z.enum(["PENDING", "INDEXING", "COMPLETED", "FAILED"]),
        message: z.string().optional(),
        processedCount: z.number().optional(),
        totalCount: z.number().optional(),
      })
    )
  );
