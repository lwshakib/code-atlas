import { inngest } from "./client";
import { Octokit } from "octokit";
import prisma from "@/lib/prisma";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getPineconeIndex } from "@/lib/pinecone";
import { INDEXING_BATCH_SIZE, MAX_EMBEDDING_TEXT_LENGTH } from "@/lib/constants";
import { generateEmbeddings, generateBatchEmbeddings } from "@/llm/embeddings";
import { codebaseChannel } from "./channels";
import { generateObjectFromGLM } from "@/llm/generateObject";
import { z } from "zod";
import { DOCS_GENERATION_SYSTEM_PROMPT } from "@/llm/prompts";




export const indexCodebase = inngest.createFunction(
  { 
    id: "index-codebase", 
    cancelOn: [
      {
        event: "codebase/index.cancel",
        match: "data.codebaseId",
      }
    ]
  },
  { event: "codebase/index.start" },
  // @ts-ignore
  async ({ event, step, publish }) => {

    const { repoFullName, codebaseId, accessToken, userId } = event.data;

    try {
      const [owner, repo] = repoFullName.split("/");
      const octokit = new Octokit({ auth: accessToken });

      // Update status to INDEXING
      await step.run("update-status-indexing", async () => {
        await prisma.codebase.update({
          where: { id: codebaseId },
          data: { status: "INDEXING" },
        });
        await publish(codebaseChannel(codebaseId).status({ status: "INDEXING" }));
      });

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
                  SET f.content = $content
                  MERGE (f)-[:BELONGS_TO]->(c)
                  `,
                  { codebaseId, path: file.path, content }
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

      // 3. Generate Documentation and Questions
      await step.run("generate-docs-and-questions", async () => {
        // Collect key context: tree structure + important files
        const importantFileNames = ["package.json", "README.md", "next.config.js", "next.config.ts", "prisma/schema.prisma", "docker-compose.yml", "tsconfig.json"];
        
        const contextFiles = await Promise.all(
          treeData
            .filter(f => importantFileNames.includes(f.path?.split('/').pop() || ""))
            .map(async (f) => {
              const { data: contentData } = await octokit.rest.git.getBlob({
                owner,
                repo,
                file_sha: f.sha!,
              });
              const content = Buffer.from(contentData.content, "base64").toString("utf-8");
              return `File: ${f.path}\nContent:\n${content.substring(0, 2000)}`;
            })
        );

        const treeContext = treeData.map(f => f.path).slice(0, 250).join("\n"); // Increased tree context

        const prompt = `Analyze this repository: ${repoFullName}

REPOSITORY STRUCTURE:
${treeContext}

CORE FILE CONTENTS:
${contextFiles.join("\n\n")}

TASK:
Generate a MASSIVELY detailed, multi-page developer wiki for this repository. 
1. EXHAUSTIVE COVERAGE: Every major directory and core file must be explained. Do not be generic; mention specific file names and their exact roles.
2. COMPLEX FLOWS: For complex interactions (e.g., auth flows, indexing pipelines, data migrations), use 'mermaid' code blocks to create architecture diagrams or flowcharts. Use standard styles (no custom colors).
3. PAGE STRUCTURE: Generate 6-10 main pages, each with multiple subsections. Be granular. Every page should have high-quality Markdown content.
4. INSIGHTFUL QUESTIONS: Generate 25+ specific questions that a developer should ask to master this codebase.

Think step-by-step about the architecture, tech stack, and data flow before generating the content.`;

        const result = await generateObjectFromGLM({
          messages: [
            { 
              role: "system", 
              content: DOCS_GENERATION_SYSTEM_PROMPT 
            },
            { role: "user", content: prompt }
          ],
          outputSchema: z.object({
            pages: z.array(z.object({
              title: z.string(),
              content: z.string(),
              subsections: z.array(z.object({
                title: z.string(),
                content: z.string()
              }))
            })),
            questions: z.array(z.string())
          })
        });

        // Save generated data to DB
        for (let i = 0; i < result.pages.length; i++) {
          const page = result.pages[i];
          const createdPage = await prisma.docPage.create({
            data: {
              title: page.title,
              content: page.content,
              order: i,
              codebaseId,
            }
          });

          if (page.subsections.length > 0) {
            await prisma.docPage.createMany({
              data: page.subsections.map((sub, subIdx) => ({
                title: sub.title,
                content: sub.content,
                order: subIdx,
                codebaseId,
                parentId: createdPage.id
              }))
            });
          }
        }

        await prisma.recommendation.createMany({
          data: result.questions.map(q => ({
            text: q,
            codebaseId
          }))
        });
      });

      // Finalize status to COMPLETED
      await step.run("finalize-indexing", async () => {
        await prisma.codebase.update({
          where: { id: codebaseId },
          data: { status: "COMPLETED" },
        });
        await publish(codebaseChannel(codebaseId).status({ status: "COMPLETED" }));
      });

      return { success: true, processedCount: treeData.length };
    } catch (error: any) {
      console.error(`Index codebase error for ${codebaseId}:`, error);
      await step.run("handle-failure", async () => {
        await prisma.codebase.update({
          where: { id: codebaseId },
          data: { status: "FAILED" },
        });
        await publish(codebaseChannel(codebaseId).status({ 
          status: "FAILED",
          message: error.message || "An unknown error occurred"
        }));
      });
      throw error;
    }
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





