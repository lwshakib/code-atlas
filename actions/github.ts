"use server";

import { Octokit } from "octokit";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { formatDistanceToNow } from 'date-fns';

/**
 * Interface for repository data.
 */
export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  updated_at: string | null;
  stargazers_count: number;
  language: string | null;
  private: boolean;
}

/**
 * Fetches the GitHub access token for the currently authenticated user.
 */
async function getGithubAccessToken() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) {
    return null;
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      providerId: "github",
    },
  });

  return account?.accessToken;
}

/**
 * Fetches the list of repositories for the authenticated user using Octokit.
 */
export async function getUserRepositories(page: number = 1): Promise<GithubRepo[]> {
  const token = await getGithubAccessToken();
  
  if (!token) {
    throw new Error("GitHub access token not found. Please log in.");
  }

  const octokit = new Octokit({ auth: token });

  try {
    const response = await octokit.request("GET /user/repos", {
      sort: "updated",
      per_page: 20,
      page,
      affiliation: "owner,collaborator",
      visibility: "all",
    });

    return response.data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      updated_at: repo.updated_at,
      stargazers_count: repo.stargazers_count,
      language: repo.language,
      private: repo.private,
    }));
  } catch (error) {
    console.error("Error fetching GitHub repositories:", error);
    throw new Error("Failed to fetch repositories from GitHub.");
  }
}

/**
 * Server action to fetch GitHub repositories.
 */
export async function fetchGithubRepositoriesAction(page: number = 1): Promise<{ success: boolean; data?: GithubRepo[]; error?: string }> {
  try {
    const repos = await getUserRepositories(page);
    return { success: true, data: repos };
  } catch (error: any) {
    console.error("fetchGithubRepositoriesAction error:", error);
    return { success: false, error: error.message || "Failed to fetch repositories" };
  }
}
