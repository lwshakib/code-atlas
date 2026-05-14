import { inngest } from "./client";
import { Octokit } from "octokit";
import {
  INDEXING_BATCH_SIZE,
  BATCH_WAIT_TIME_MS,
  MAX_TOKENS_PER_BATCH,
  CHARS_PER_TOKEN_ESTIMATE,
} from "@/lib/constants";
import {
  fetchRepoTree,
  updateCodebaseStatus,
  fetchAndFormatFile,
  generateBatchSummaries,
  processEmbeddingSubBatch,
  generateRepositoryDocs,
} from "./helpers";

/**
 * MAIN INDEXING PIPELINE
 *
 * This function orchestrates the multi-step process of indexing a repository.
 * It handles rate limiting, batch processing, and AI generation.
 */
export const indexCodebase = inngest.createFunction(
  {
    id: "index-codebase",
    cancelOn: [
      {
        event: "codebase/index.cancel",
        match: "data.codebaseId",
      },
    ],
  },
  { event: "codebase/index.start" },
  async ({ event, step, publish }: any) => {
    const { repoFullName, codebaseId, accessToken } = event.data;

    try {
      const [owner, repo] = repoFullName.split("/");
      const octokit = new Octokit({ auth: accessToken });

      // Step 0: Set status to INDEXING
      await step.run("update-status-indexing", async () => {
        await updateCodebaseStatus(codebaseId, "INDEXING", publish);
      });

      // Step 1: Fetch Repository Tree
      const treeData = await step.run("fetch-repo-tree", async () => {
        return await fetchRepoTree(octokit, owner, repo);
      });

      // Step 2: Process Files in Batches
      const BATCH_SIZE = INDEXING_BATCH_SIZE;

      for (let i = 0; i < treeData.length; i += BATCH_SIZE) {
        const batch = treeData.slice(i, i + BATCH_SIZE);

        // A. Summarization (50 files) - No mandatory sleep unless 429 occurs
        let batchSummaries;
        try {
          batchSummaries = await step.run(
            `summarize-batch-${i / BATCH_SIZE}`,
            async () => {
              const innerOctokit = new Octokit({ auth: accessToken });
              
              // NEW: Concurrency-limited fetching to avoid memory pressure (OOM)
              // Instead of fetching all 50 files in parallel, we fetch them in groups of 10.
              const FETCH_CONCURRENCY = 10;
              const fileContents: any[] = [];
              
              for (let j = 0; j < batch.length; j += FETCH_CONCURRENCY) {
                const subBatch = batch.slice(j, j + FETCH_CONCURRENCY);
                const subBatchResults = await Promise.all(
                  subBatch.map((file: any) =>
                    fetchAndFormatFile(innerOctokit, owner, repo, file),
                  ),
                );
                fileContents.push(...subBatchResults);
              }

              const validFiles = fileContents.filter(
                (f): f is NonNullable<typeof f> => f !== null,
              );
              if (validFiles.length === 0) return { summaries: [], files: [] };

              const summaries = await generateBatchSummaries(
                validFiles.map((f) => ({ path: f.path, content: f.content })),
              );

              return { summaries: summaries.summaries, files: validFiles };
            },
          );
        } catch (error: any) {
          // If we hit a rate limit (429), sleep for 1 minute before Inngest retries
          if (error?.status === 429 || error?.message?.includes("429")) {
            await step.sleep(
              `wait-on-429-${i / BATCH_SIZE}`,
              BATCH_WAIT_TIME_MS,
            );
          }
          throw error;
        }

        // B. Sub-batch Embedding (30k tokens)
        const validFiles = batchSummaries.files;
        let currentSubBatch: any[] = [];
        let currentSubBatchTokens = 0;
        let subBatchCount = 0;

        for (const file of validFiles) {
          const estimatedTokens = Math.ceil(
            file.text.length / CHARS_PER_TOKEN_ESTIMATE,
          );

          if (
            currentSubBatchTokens + estimatedTokens > MAX_TOKENS_PER_BATCH &&
            currentSubBatch.length > 0
          ) {
            await step.run(
              `embed-subbatch-${i / BATCH_SIZE}-${subBatchCount}`,
              async () => {
                await processEmbeddingSubBatch(
                  currentSubBatch,
                  batchSummaries.summaries,
                  codebaseId,
                );
              },
            );
            await step.sleep(
              `wait-after-subbatch-${i / BATCH_SIZE}-${subBatchCount}`,
              BATCH_WAIT_TIME_MS,
            );
            currentSubBatch = [];
            currentSubBatchTokens = 0;
            subBatchCount++;
          }

          currentSubBatch.push(file);
          currentSubBatchTokens += estimatedTokens;
        }

        if (currentSubBatch.length > 0) {
          await step.run(`embed-subbatch-final-${i / BATCH_SIZE}`, async () => {
            await processEmbeddingSubBatch(
              currentSubBatch,
              batchSummaries.summaries,
              codebaseId,
            );
          });
          await step.sleep(
            `wait-after-subbatch-final-${i / BATCH_SIZE}`,
            BATCH_WAIT_TIME_MS,
          );
        }
      }

      // Step 3: Generate Wiki & Questions
      await step.run("generate-docs-and-questions", async () => {
        return await generateRepositoryDocs(
          octokit,
          owner,
          repo,
          repoFullName,
          codebaseId,
          treeData,
          treeData.length,
        );
      });

      // Step 4: Finalize
      await step.run("finalize-indexing", async () => {
        await updateCodebaseStatus(codebaseId, "COMPLETED", publish);
        // Email notification logic is handled within the main loop or can be separate
        // For simplicity, we stick to the core flow here
      });

      return { success: true, processedCount: treeData.length };
    } catch (error: any) {
      console.error(`Index codebase error for ${codebaseId}:`, error);
      await step.run("handle-failure", async () => {
        await updateCodebaseStatus(
          codebaseId,
          "FAILED",
          publish,
          error.message,
        );
      });
      throw error;
    }
  },
);
