"use server";

import { Octokit } from "octokit";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

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
/**
 * Fetches the GitHub access token for the currently authenticated user.
 * It looks up the connected account in the Postgres database linked to the user's session.
 */
async function getGithubAccessToken() {
  // Retrieve the session using Better Auth from request headers
  const session = await auth.api.getSession({
    headers: await headers()
  });

  // If no session, the user is anonymous
  if (!session) {
    return null;
  }

  // Find the GitHub account provider linked to this user
  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      providerId: "github",
    },
  });

  // Return the stored OAuth access token (used for Octokit requests)
  return account?.accessToken;
}

/**
 * Fetches the list of repositories for the authenticated user using Octokit.
 * Supports pagination to handle large numbers of repositories.
 */
export async function getUserRepositories(page: number = 1): Promise<GithubRepo[]> {
  // Get the token first
  const token = await getGithubAccessToken();
  
  if (!token) {
    throw new Error("GitHub access token not found. Please log in.");
  }

  // Initialize Octokit with the user's OAuth token
  const octokit = new Octokit({ auth: token });

  try {
    // Request repositories where the user is an owner or collaborator
    const response = await octokit.request("GET /user/repos", {
      sort: "updated",           // Sort by recently updated repositories
      per_page: 20,              // Limit results per page
      page,                      // Current page index
      affiliation: "owner,collaborator",
      visibility: "all",
    });

    // Map the raw GitHub API response to our custom GithubRepo interface
    return response.data.map((repo: GithubRepo) => ({
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
 * Used by React Server Components or Client Components via 'use action'.
 */
export async function fetchGithubRepositoriesAction(page: number = 1): Promise<{ success: boolean; data?: GithubRepo[]; error?: string }> {
  try {
    // Call our shared helper to get the data
    const repos = await getUserRepositories(page);
    return { success: true, data: repos };
  } catch (error) {
    const err = error as Error;
    console.error("fetchGithubRepositoriesAction error:", err);
    // Return a standard error response for the UI to handle
    return { success: false, error: err.message || "Failed to fetch repositories" };
  }
}
