import { inngest } from "./client";
import { Octokit } from "octokit";
import prisma from "@/lib/prisma";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getPineconeIndex } from "@/lib/pinecone";
import { INDEXING_BATCH_SIZE, MAX_EMBEDDING_TEXT_LENGTH } from "@/lib/constants";
import { generateEmbeddings, generateBatchEmbeddings } from "@/llm/embeddings";
// import { generateTextFromGLM } from "@/llm/generateText"; // Removed logic for summary generation as requested

export const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "test/hello.world" }] },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return { message: `Hello ${event.data.email}!` };
  },
);

export const indexCodebase = inngest.createFunction(
  { id: "index-codebase", triggers: [{ event: "codebase/index.start" }] },
  async ({ event, step }) => {
    const { repoFullName, codebaseId, accessToken, userId } = event.data;
    const [owner, repo] = repoFullName.split("/");
    const octokit = new Octokit({ auth: accessToken });

    // 1. Fetch Repository Tree
    const treeData = await step.run("fetch-repo-tree", async () => {
      const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
      const { data } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: repoInfo.default_branch,
        recursive: "true",
      });
      return data.tree.filter(
        (item) => item.type === "blob" && isRelevantFile(item.path || "")
      );
    });

    // 2. Process Files in Batches (using configured INDEXING_BATCH_SIZE)
    const BATCH_SIZE = INDEXING_BATCH_SIZE;

    for (let i = 0; i < treeData.length; i += BATCH_SIZE) {
      const batch = treeData.slice(i, i + BATCH_SIZE);
      
      await step.run(`process-batch-${i / BATCH_SIZE}`, async () => {
        const driver = getNeo4jDriver();
        const pineconeIndex = getPineconeIndex();
        
        // A. Fetch all file contents in parallel within the batch
        const fileContents = await Promise.all(
          batch.map(async (file) => {
            try {
              const { data: contentData } = await octokit.rest.git.getBlob({
                owner,
                repo,
                file_sha: file.sha!,
              });
              const content = Buffer.from(contentData.content, "base64").toString("utf-8");
              return { file, content, text: `File: ${file.path}\n\nCode:\n${content.substring(0, MAX_EMBEDDING_TEXT_LENGTH)}` };
            } catch (err) {
              console.error(`Error fetching ${file.path}:`, err);
              return null;
            }
          })
        );

        const validFiles = fileContents.filter((f): f is NonNullable<typeof f> => f !== null);
        if (validFiles.length === 0) return;

        // B. Generate Embeddings in BATCH (Significant cost/performance improvement)
        const embeddings = await generateBatchEmbeddings(validFiles.map(f => f.text));

        const pineconeRecords: any[] = [];
        const session = driver.session();

        try {
          for (let j = 0; j < validFiles.length; j++) {
            const { file, content } = validFiles[j];
            const embedding = embeddings[j];

            pineconeRecords.push({
              id: `${codebaseId}:${file.path}`,
              values: embedding,
              metadata: {
                codebaseId,
                path: file.path,
                contentSnippet: content.substring(0, 200),
              },
            });

            // Sync to Neo4j
            await session.executeWrite((tx) =>
              tx.run(
                `
                MERGE (c:Codebase {id: $codebaseId})
                MERGE (f:File {path: $path, codebaseId: $codebaseId})
                MERGE (f)-[:BELONGS_TO]->(c)
                `,
                { codebaseId, path: file.path }
              )
            );
          }

          // C. Batched Sync to Pinecone
          if (pineconeRecords.length > 0) {
            await pineconeIndex.upsert({
              records: pineconeRecords
            });
          }
        } finally {
          await session.close();
        }
      });
    }

    return { success: true, processedCount: treeData.length };
  }
);

function isRelevantFile(path: string): boolean {
  const ignoredExtensions = [
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot",
    ".mp4", ".webm", ".zip", ".tar", ".gz", ".pdf", ".exe", ".dll", ".so",
    "package-lock.json", "bun.lock", "yarn.lock", ".gitignore", ".prettierrc", ".eslintignore",
    ".next", "node_modules", ".git"
  ];
  return !ignoredExtensions.some((ext) => path.toLowerCase().endsWith(ext)) && !path.includes('node_modules/') && !path.includes('.next/');
}
