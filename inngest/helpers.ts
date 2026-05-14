import { Octokit } from "octokit";
import {
  MAX_EMBEDDING_TEXT_LENGTH,
  CHARS_PER_TOKEN_ESTIMATE,
  MAX_TOKENS_PER_BATCH,
} from "@/lib/constants";
import { PineconeRecord, RecordMetadata } from "@pinecone-database/pinecone";
import { embedDocument, generateObject } from "@/llm";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getPineconeIndex } from "@/lib/pinecone";
import { codebaseChannel } from "./channels";
import {
  DOCS_GENERATION_SYSTEM_PROMPT,
  WIKI_GENERATION_USER_PROMPT,
  BATCH_SUMMARIZATION_USER_PROMPT,
} from "@/llm/prompts";
import { sendIndexingCompleteEmail } from "@/lib/email";

/**
 * Checks if a file path is relevant for indexing.
 * Filters out binary files, lock files, and hidden directories.
 */
export function isRelevantFile(path: string): boolean {
  const ignoredExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".pdf",
    ".zip",
    ".exe",
    ".dll",
    ".so",
    "package-lock.json",
    "pnpm-lock.yaml",
    "bun.lock",
    "bun.lockb",
    "yarn.lock",
    ".gitignore",
    ".prettierrc",
    ".eslintignore",
    ".next",
    "node_modules",
    ".git",
  ];
  return (
    !ignoredExtensions.some((ext) => path.toLowerCase().endsWith(ext)) &&
    !path.includes("node_modules/") &&
    !path.includes(".next/")
  );
}

/**
 * Fetches the raw content of a file from GitHub and formats it for embedding.
 */
export async function fetchAndFormatFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  file: { path: string; sha: string },
) {
  try {
    const { data: contentData } = await octokit.rest.git.getBlob({
      owner,
      repo,
      file_sha: file.sha,
    });
    const content = Buffer.from(contentData.content, "base64").toString(
      "utf-8",
    );
    return {
      file,
      content,
      path: file.path,
      text: `File: ${file.path}\n\nCode:\n${content.substring(0, MAX_EMBEDDING_TEXT_LENGTH)}`,
    };
  } catch (err) {
    console.error(`Error fetching file ${file.path}:`, err);
    return null;
  }
}

/**
 * Standardizes the creation of Pinecone records.
 */
export function createPineconeRecord(
  codebaseId: string,
  path: string,
  content: string,
  embedding: number[],
): PineconeRecord<RecordMetadata> {
  return {
    id: `${codebaseId}:${path}`,
    values: embedding,
    metadata: {
      codebaseId: String(codebaseId),
      path: path,
      contentSnippet: content.substring(0, 200),
    },
  };
}

/**
 * Generates summaries for a batch of files in a single LLM call.
 */
export async function generateBatchSummaries(
  files: { path: string; content: string }[],
) {
  const prompt = BATCH_SUMMARIZATION_USER_PROMPT(files);
  const systemPrompt =
    "You are a senior software architect summarizing codebase components.";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  const schema = z.object({
    summaries: z.array(
      z.object({
        path: z.string(),
        summary: z.string(),
      }),
    ),
  });

  return await generateObject<{
    summaries: { path: string; summary: string }[];
  }>(messages, schema);
}

// --- NEW BIG HELPER FUNCTIONS ---

/**
 * Updates the status of a codebase and publishes a socket event.
 */
export async function updateCodebaseStatus(
  codebaseId: string,
  status: "INDEXING" | "COMPLETED" | "FAILED",
  publish: (event: unknown) => Promise<unknown>,
  message?: string,
) {
  await prisma.codebase.update({
    where: { id: codebaseId },
    data: { status },
  });
  await publish(codebaseChannel(codebaseId).status({ status, message }));
}

interface RepoTreeItem {
  path: string;
  sha: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * Fetches the entire repository tree and filters for relevant files.
 */
export async function fetchRepoTree(
  octokit: Octokit,
  owner: string,
  repo: string,
) {
  const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: repoInfo.default_branch || "main",
    recursive: "true",
  });

  return (data.tree as RepoTreeItem[]).filter(
    (item) => item.type === "blob" && item.path && isRelevantFile(item.path),
  );
}

/**
 * Handles the embedding generation and database sync for a sub-batch of files.
 */
export async function processEmbeddingSubBatch(
  files: {
    text: string;
    file: { path: string; sha: string };
    content: string;
  }[],
  summaries: { path: string; summary: string }[],
  codebaseId: string,
) {
  const driver = getNeo4jDriver();
  const pineconeIndex = getPineconeIndex();

  // Generate Embeddings in parallel for the sub-batch
  const embeddings = await Promise.all(
    files.map((f) => embedDocument(f.text, f.file.path || "none")),
  );

  const pineconeRecords: PineconeRecord<RecordMetadata>[] = [];
  const session = driver.session();

  try {
    for (let j = 0; j < files.length; j++) {
      const { file, content } = files[j];
      const embedding = embeddings[j];
      const summary =
        summaries.find((s) => s.path === file.path)?.summary || "";

      pineconeRecords.push(
        createPineconeRecord(codebaseId, file.path, content, embedding),
      );

      // Sync to Neo4j
      await session.executeWrite((tx) =>
        tx.run(
          `
          MERGE (c:Codebase {id: $codebaseId})
          MERGE (f:File {path: $path, codebaseId: $codebaseId})
          SET f.content = $content, f.summary = $summary
          MERGE (f)-[:BELONGS_TO]->(c)
          `,
          { codebaseId, path: file.path, content, summary },
        ),
      );
    }

    // Sync to Pinecone
    if (pineconeRecords.length > 0) {
      await pineconeIndex.upsert({ records: pineconeRecords });
    }
  } finally {
    await session.close();
  }
}

/**
 * Generates the repository documentation and suggested questions.
 */
export async function generateRepositoryDocs(
  octokit: Octokit,
  owner: string,
  repo: string,
  repoFullName: string,
  codebaseId: string,
  treeData: RepoTreeItem[],
) {
  // 1. Collect key context
  const importantFileNames = [
    "package.json",
    "README.md",
    "next.config.js",
    "next.config.ts",
    "prisma/schema.prisma",
    "docker-compose.yml",
    "tsconfig.json",
  ];

  const contextFiles = await Promise.all(
    treeData
      .filter((f: any) =>
        importantFileNames.includes(f.path?.split("/").pop() || ""),
      )
      .map(async (f: any) => {
        const { data: contentData } = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: f.sha!,
        });
        const content = Buffer.from(contentData.content, "base64").toString(
          "utf-8",
        );
        return `File: ${f.path}\nContent:\n${content.substring(0, 2000)}`;
      }),
  );

  // 2. Fetch all summaries from Neo4j
  const driver = getNeo4jDriver();
  const session = driver.session();
  const summaryResults = await session.executeRead((tx) =>
    tx.run(
      `MATCH (f:File {codebaseId: $codebaseId}) RETURN f.path as path, f.summary as summary`,
      { codebaseId },
    ),
  );
  await session.close();

  const atlasContext = summaryResults.records
    .map((r) => `${r.get("path")}: ${r.get("summary")}`)
    .join("\n");

  const prompt = WIKI_GENERATION_USER_PROMPT(
    repoFullName,
    atlasContext,
    contextFiles,
  );

  // Use a manually defined Gemini schema for maximum reliability with nested structures
  const manualSchema = {
    type: "object",
    properties: {
      pages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The descriptive title of this wiki page",
            },
            content: {
              type: "string",
              description:
                "Main architectural overview and details for this page (Markdown)",
            },
            subsections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Sub-component or specific flow title",
                  },
                  content: {
                    type: "string",
                    description: "Deep-dive technical explanation (Markdown)",
                  },
                },
                required: ["title", "content"],
              },
              description: "Granular breakdowns of the page's topic",
            },
          },
          required: ["title", "content", "subsections"],
        },
        description: "A list of comprehensive documentation pages",
      },
      questions: {
        type: "array",
        items: { type: "string" },
        description:
          "A list of 25+ specific technical questions to test codebase knowledge",
      },
    },
    required: ["pages", "questions"],
  };

  const messages = [
    { role: "system", content: DOCS_GENERATION_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  const result = await generateObject<{
    pages: {
      title: string;
      content: string;
      subsections: { title: string; content: string }[];
    }[];
    questions: string[];
  }>(messages, manualSchema);

  // 3. Save to DB
  const pages = result.pages || [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Fallbacks in case the LLM omits required fields
    const pageTitle = page.title || `Documentation Page ${i + 1}`;
    const pageContent =
      page.content || "Content generation failed or was omitted by AI.";

    const createdPage = await prisma.docPage.create({
      data: {
        title: pageTitle,
        content: pageContent,
        order: i,
        codebaseId,
      },
    });

    const subsections = page.subsections || [];
    if (subsections.length > 0) {
      await prisma.docPage.createMany({
        data: subsections.map((sub, subIdx) => ({
          title: sub.title || `Subsection ${subIdx + 1}`,
          content: sub.content || "",
          order: subIdx,
          codebaseId,
          parentId: createdPage.id,
        })),
      });
    }
  }

  const questions = result.questions || [];
  if (questions.length > 0) {
    // Filter out empty strings just in case
    const validQuestions = questions.filter(
      (q) => typeof q === "string" && q.trim().length > 0,
    );
    if (validQuestions.length > 0) {
      await prisma.recommendation.createMany({
        data: validQuestions.map((q) => ({
          text: q,
          codebaseId,
        })),
      });
    }
  }

  console.log(
    `[GEN_DOCS] Successfully saved ${pages.length} pages and ${questions.length} questions for ${codebaseId}`,
  );

  return result;
}
