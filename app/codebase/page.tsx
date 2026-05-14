/**
 * CODEBASE DASHBOARD
 *
 * This page displays a list of the user's synchronize codebases and provides
 * tools to import new ones from GitHub. It manages repository fetching,
 * indexing status tracking, and basic CRUD operations (Rename/Delete).
 */

"use client";

import React from "react";
import { Github, Plus, LayoutDashboard } from "lucide-react";
import { LogoWithText } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { UserMenu } from "@/components/UserMenu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Link as LinkIcon,
  Download,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Lock,
  Search,
  Trash2,
} from "lucide-react";
import { fetchGithubRepositoriesAction } from "@/actions/github"; // Action to fetch user repos via Octokit
import { GithubRepo } from "@/actions/github";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CodebaseRow } from "@/components/CodebaseRow"; // Individual row component with Realtime status

interface Codebase {
  id: string;
  name: string;
  description?: string;
  indexedAt?: string;
  status: string;
  createdAt: string;
}

export default function CodebasePage() {
  // 1. UI STATE
  const [scrolled, setScrolled] = React.useState(false); // Header aesthetic state
  const [isNewCodebaseOpen, setIsNewCodebaseOpen] = React.useState(false); // Modal visibility
  const [dialogView, setDialogView] = React.useState<
    "selection" | "url" | "import"
  >("selection"); // Modal routing state

  // 2. REPOSITORY & SEARCH STATE
  const [repoUrl, setRepoUrl] = React.useState("");
  const [repositories, setRepositories] = React.useState<GithubRepo[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoadingRepos, setIsLoadingRepos] = React.useState(false);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [isIndexing, setIsIndexing] = React.useState(false); // Global indexing lock
  const [page, setPage] = React.useState(1); // Pagination for GitHub API
  const [hasMore, setHasMore] = React.useState(true);
  const [repoError, setRepoError] = React.useState<string | null>(null);

  // 3. CODEBASE LIST STATE
  const [userCodebases, setUserCodebases] = React.useState<Codebase[]>([]);
  const [isLoadingCodebases, setIsLoadingCodebases] = React.useState(true);

  // 4. CRUD DIALOG STATE
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedCodebase, setSelectedCodebase] =
    React.useState<Codebase | null>(null);
  const [newName, setNewName] = React.useState("");
  const [isActionLoading, setIsActionLoading] = React.useState(false); // Loading state for Rename/Delete buttons

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // 5. SESSION
  const { data: session } = authClient.useSession();

  /**
   * FETCH REPOS
   * Triggers the server action to pull repositories from GitHub API.
   */
  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    setRepoError(null);
    setPage(1);
    setHasMore(true);
    const result = await fetchGithubRepositoriesAction(1);
    if (result.success && result.data) {
      setRepositories(result.data);
      if (result.data.length < 20) setHasMore(false);
    } else {
      setRepoError(result.error || "Failed to load repositories");
    }
    setIsLoadingRepos(false);
  };

  /**
   * FETCH USER CODEBASES
   * Fetches the list of already-synchronized codebases from our local PostgreSQL database.
   */
  const fetchUserCodebases = React.useCallback(async () => {
    setIsLoadingCodebases(true);
    try {
      const response = await fetch("/api/codebases");
      const result = await response.json();
      if (result.success && result.data) {
        setUserCodebases(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch user codebases:", error);
    } finally {
      setIsLoadingCodebases(false);
    }
  }, []);

  /**
   * HANDLE INDEXING
   * Sends a POST request to /api/codebases to start the background indexing process.
   */
  const handleIndex = React.useCallback(
    async (repoFullName: string) => {
      setIsIndexing(true);
      toast.loading("Starting codebase indexing...", { id: "indexing" });

      try {
        const response = await fetch("/api/codebases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoFullName }),
        });

        const result = await response.json();

        if (result.success) {
          toast.success("Codebase indexing started!", { id: "indexing" });
          setIsNewCodebaseOpen(false);
          fetchUserCodebases(); // Refresh the list to show the new pending entry
        } else {
          toast.error(result.error || "Failed to index codebase", {
            id: "indexing",
          });
        }
      } catch {
        toast.error("An unexpected error occurred", { id: "indexing" });
      } finally {
        setIsIndexing(false);
      }
    },
    [fetchUserCodebases],
  );

  /**
   * REMOVE CODEBASE (UI Only)
   * Local state helper to remove a codebase from the list after deletion.
   */
  const removeCodebase = (id: string) => {
    setUserCodebases((prev) => prev.filter((cb) => cb.id !== id));
  };

  /**
   * INITIALIZATION EFFECT
   * Loads codebases on mount and checks for "pending_repo_url" (transferred from landing page).
   */
  React.useEffect(() => {
    if (session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchUserCodebases();

      // Auto-start indexing if a repo was selected on the landing page
      const pendingRepo = localStorage.getItem("pending_repo_url");
      if (pendingRepo) {
        localStorage.removeItem("pending_repo_url");
        handleIndex(pendingRepo);
      }
    }
  }, [session, handleIndex, fetchUserCodebases]);

  /**
   * INFINITE SCROLL FOR REPOS
   * Loads the next page of GitHub repositories.
   */
  const loadMore = async () => {
    if (isFetchingMore || !hasMore || searchQuery) return;

    setIsFetchingMore(true);
    const nextPage = page + 1;
    const result = await fetchGithubRepositoriesAction(nextPage);

    if (result.success && result.data) {
      if (result.data.length === 0) {
        setHasMore(false);
      } else {
        setRepositories((prev) => [...prev, ...result.data!]);
        setPage(nextPage);
        if (result.data.length < 20) setHasMore(false);
      }
    }
    setIsFetchingMore(false);
  };

  /**
   * SCROLL HANDLER (Inside Repo List)
   * Triggers infinite scroll when reaching the bottom of the list.
   */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      loadMore();
    }
  };

  /**
   * AUTO-FETCH REPOS ON DIALOG CHANGE
   */
  React.useEffect(() => {
    if (dialogView === "import" && session && repositories.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRepos();
    }
  }, [dialogView, session, repositories.length]);

  /**
   * REDIRECT TO LOGIN
   */
  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/codebase",
    });
  };

  /**
   * SUBMIT PUBLIC URL
   */
  const handleUrlSubmit = () => {
    if (!repoUrl) return;
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (match) {
      handleIndex(match[1]);
    } else {
      toast.error("Invalid GitHub URL");
    }
  };

  /**
   * GLOBAL WINDOW SCROLL (Header animation)
   */
  React.useEffect(() => {
    const handleWindowScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleWindowScroll);
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, []);

  /**
   * RENAME HANDLER
   * Optimistically updates the UI and sends a PATCH request to the API.
   */
  const handleRename = async () => {
    if (!selectedCodebase || !newName.trim()) return;

    const originalCodebases = [...userCodebases]; // Snapshot for rollback

    // Optimistically update the UI
    setUserCodebases((prev) =>
      prev.map((cb) =>
        cb.id === selectedCodebase.id ? { ...cb, name: newName.trim() } : cb,
      ),
    );
    setIsRenameDialogOpen(false);

    try {
      const response = await fetch(`/api/codebases/${selectedCodebase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Codebase renamed successfully");
      } else {
        setUserCodebases(originalCodebases); // Rollback
        toast.error(result.error || "Failed to rename codebase");
      }
    } catch {
      setUserCodebases(originalCodebases); // Rollback
      toast.error("An unexpected error occurred");
    }
  };

  /**
   * DELETE HANDLER
   * Sends a DELETE request to clear entries across multiple systems (Postgres, Pinecone, Neo4j).
   */
  const handleDelete = async () => {
    if (!selectedCodebase) return;
    setIsActionLoading(true);
    try {
      const response = await fetch(`/api/codebases/${selectedCodebase.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Codebase deleted successfully");
        setIsDeleteDialogOpen(false);
        fetchUserCodebases(); // Full refresh ensures consistency
      } else {
        toast.error(result.error || "Failed to delete codebase");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsNewCodebaseOpen(open);
    if (!open) {
      // Reset view when closing
      setTimeout(() => setDialogView("selection"), 300);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Navigation */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/80 backdrop-blur-md border-b border-border py-2"
            : "bg-transparent py-2"
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center w-1/3">
            <Link href="/">
              <LogoWithText size={28} />
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end w-1/3 gap-3">
            {!session ? (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 h-9 rounded-full px-5 border-border/50 bg-transparent hover:bg-secondary/50"
                onClick={handleSignIn}
              >
                <Github className="w-4 h-4" />
                <span className="text-xs font-medium">Login</span>
              </Button>
            ) : (
              <UserMenu />
            )}
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-6 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Codebases</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage and analyze your synchronized repositories.
            </p>
          </div>
          <Button
            onClick={() =>
              !session ? handleSignIn() : setIsNewCodebaseOpen(true)
            }
            size="sm"
            className="rounded-full h-10 px-6 gap-2 bg-white text-black hover:bg-white/90 border-none transition-all shadow-lg shadow-white/5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs font-semibold">New Codebase</span>
          </Button>
        </div>

        {isLoadingCodebases ? (
          <div className="w-full border-y border-border/50 bg-background">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/50 hover:bg-transparent bg-secondary/5">
                  <TableHead className="w-[40%] text-xs font-semibold text-muted-foreground/80 h-10 align-middle">
                    Name
                  </TableHead>
                  <TableHead className="w-[40%] text-xs font-semibold text-muted-foreground/80 h-10 align-middle">
                    Description
                  </TableHead>
                  <TableHead className="w-[15%] text-xs font-semibold text-muted-foreground/80 text-right h-10 align-middle">
                    Indexed
                  </TableHead>
                  <TableHead className="w-[5%] text-xs font-semibold text-muted-foreground/80 text-right h-10 align-middle"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3].map((i) => (
                  <TableRow key={i} className="border-b border-border/50">
                    <TableCell className="py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-middle">
                      <Skeleton className="h-3 w-32" />
                    </TableCell>
                    <TableCell className="py-4 align-middle text-right">
                      <div className="flex justify-end">
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </TableCell>
                    <TableCell className="py-4 align-middle text-right">
                      <div className="flex justify-end">
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : userCodebases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/50 rounded-[3rem] bg-secondary/5">
            <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center mb-6">
              <LayoutDashboard className="w-8 h-8 text-primary/40" />
            </div>
            <h2 className="text-xl font-semibold">No codebases yet</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
              Index your first repository to start analyzing and generating
              insights.
            </p>
            <Button
              variant="outline"
              className="mt-8 rounded-full h-10 px-8 border-primary/20 hover:bg-primary/5"
              onClick={() =>
                !session ? handleSignIn() : setIsNewCodebaseOpen(true)
              }
            >
              Get Started
            </Button>
          </div>
        ) : (
          <div className="w-full border-y border-border/50 bg-background">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/50 hover:bg-transparent bg-secondary/5">
                  <TableHead className="w-[40%] text-xs font-semibold text-muted-foreground/80 h-10 align-middle">
                    Name
                  </TableHead>
                  <TableHead className="w-[40%] text-xs font-semibold text-muted-foreground/80 h-10 align-middle">
                    Description
                  </TableHead>
                  <TableHead className="w-[15%] text-xs font-semibold text-muted-foreground/80 text-right h-10 align-middle">
                    Indexed
                  </TableHead>
                  <TableHead className="w-[5%] text-xs font-semibold text-muted-foreground/80 text-right h-10 align-middle"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-0 bg-transparent">
                {userCodebases.map((cb) => (
                  <CodebaseRow
                    key={cb.id}
                    codebase={cb}
                    onRename={(cb) => {
                      setSelectedCodebase(cb);
                      setNewName(cb.name);
                      setIsRenameDialogOpen(true);
                    }}
                    onDelete={(cb) => {
                      setSelectedCodebase(cb);
                      setIsDeleteDialogOpen(true);
                    }}
                    removeCodebase={removeCodebase}
                    onStatusChange={(id, newStatus) => {
                      setUserCodebases((prev) =>
                        prev.map((c) =>
                          c.id === id ? { ...c, status: newStatus } : c,
                        ),
                      );
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* New Codebase Dialog */}
      <Dialog open={isNewCodebaseOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-3xl rounded-3xl shadow-2xl transition-all duration-300">
          <div className="p-8 min-h-[400px] flex flex-col">
            <header className="mb-8 flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {dialogView === "selection"
                    ? "Add new codebase"
                    : dialogView === "url"
                      ? "GitHub Public URL"
                      : "Import Repositories"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {dialogView === "selection"
                    ? "Connect your repository to begin."
                    : dialogView === "url"
                      ? "Paste a link to any public repository."
                      : "Select an existing GitHub project."}
                </DialogDescription>
              </div>
              {dialogView !== "selection" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-3 h-8 bg-secondary/30 hover:bg-secondary/50 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all"
                  onClick={() => setDialogView("selection")}
                >
                  Back
                </Button>
              )}
            </header>

            <div className="flex-1">
              {dialogView === "selection" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <button
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 hover:border-primary/20 transition-all group text-center h-full"
                    onClick={() => setDialogView("url")}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform duration-300">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm block mb-1 tracking-tight">
                      Public URL
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight px-2">
                      Analyze any public repo instantly.
                    </span>
                  </button>

                  <button
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 hover:border-primary/20 transition-all group text-center h-full"
                    onClick={() => setDialogView("import")}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform duration-300">
                      <Download className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm block mb-1 tracking-tight">
                      Import Repo
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight px-2">
                      Connect and sync your own projects.
                    </span>
                  </button>
                </div>
              )}

              {dialogView === "url" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="url"
                      className="text-[10px] font-bold text-muted-foreground ml-1"
                    >
                      Repository endpoint
                    </Label>
                    <div className="relative group">
                      <Input
                        id="url"
                        placeholder="https://github.com/username/repository"
                        className="bg-secondary/20 h-14 border-border/50 focus-visible:ring-primary/20 rounded-xl pl-5 pr-14 transition-all text-sm"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        autoFocus
                      />
                      <div className="absolute right-2 top-2">
                        <Button
                          size="icon"
                          className="h-10 w-10 rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all bg-primary text-primary-foreground"
                          onClick={handleUrlSubmit}
                          disabled={isIndexing || !repoUrl}
                        >
                          {isIndexing ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] text-muted-foreground leading-normal italic">
                      Public repositories are processed and cached for fast
                      access.
                    </p>
                  </div>
                </div>
              )}

              {dialogView === "import" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3 px-1 gap-3">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="Search repos..."
                        className="bg-secondary/15 h-8 border-border/40 focus-visible:ring-primary/10 rounded-lg pl-8 pr-2 text-[10px] transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      onClick={fetchRepos}
                      disabled={isLoadingRepos}
                      title="Refresh repositories"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isLoadingRepos ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </div>

                  <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 custom-scrollbar min-h-[220px] max-h-[300px]"
                  >
                    {isLoadingRepos && repositories.length === 0 ? (
                      <div className="space-y-1.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 rounded-xl border border-border/20 bg-secondary/5 opacity-60"
                          >
                            <div className="h-8 w-8 rounded-lg bg-background border border-border/50 items-center justify-center flex shrink-0 shadow-sm overflow-hidden">
                              <Skeleton className="h-full w-full opacity-30" />
                            </div>
                            <div className="flex-1 space-y-1.5 overflow-hidden">
                              <Skeleton className="h-4 w-[60%] rounded-md" />
                              <div className="flex gap-2">
                                <Skeleton className="h-3 w-12 rounded-sm" />
                                <Skeleton className="h-3 w-16 rounded-sm" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : repoError ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-destructive/5 rounded-2xl border border-destructive/10">
                        <AlertCircle className="w-6 h-6 text-destructive/40 mb-3" />
                        <p className="text-[10px] font-semibold text-destructive/80 mb-3">
                          {repoError}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-[9px] font-bold"
                          onClick={fetchRepos}
                        >
                          Try Again
                        </Button>
                      </div>
                    ) : repositories.filter((r) =>
                        r.name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()),
                      ).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-3 opacity-50">
                        <Github className="w-8 h-8 text-muted-foreground/30" />
                        <p className="text-[10px] text-muted-foreground">
                          {searchQuery
                            ? "No matching repos found."
                            : "No repositories found."}
                        </p>
                      </div>
                    ) : (
                      <>
                        {repositories
                          .filter((r) =>
                            r.name
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase()),
                          )
                          .map((repo) => (
                            <div
                              key={repo.id}
                              className={`flex items-center justify-between p-3 rounded-xl border border-border/30 bg-secondary/5 hover:bg-secondary/15 hover:border-primary/10 cursor-pointer transition-all group ${isIndexing ? "opacity-50 pointer-events-none" : ""}`}
                              onClick={() => handleIndex(repo.full_name)}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="hidden sm:flex flex-shrink-0 w-8 h-8 rounded-lg bg-background border border-border/50 items-center justify-center shadow-sm group-hover:bg-primary/5 transition-colors">
                                  <Github className="w-4 h-4 text-primary/70" />
                                </div>
                                <div className="overflow-hidden">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold truncate tracking-tight">
                                      {repo.name}
                                    </p>
                                    {repo.private && (
                                      <Lock className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {repo.language && (
                                      <span className="text-[9px] text-muted-foreground font-medium">
                                        {repo.language}
                                      </span>
                                    )}
                                    <span className="text-[9px] text-muted-foreground/60">
                                      {repo.updated_at
                                        ? formatDistanceToNow(
                                            new Date(repo.updated_at),
                                            { addSuffix: true },
                                          )
                                        : "Recently"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all flex-shrink-0" />
                            </div>
                          ))}
                        {isFetchingMore && (
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/20 bg-secondary/5 opacity-60">
                            <div className="h-8 w-8 rounded-lg bg-background border border-border/50 items-center justify-center flex shrink-0 shadow-sm overflow-hidden">
                              <Skeleton className="h-full w-full opacity-30" />
                            </div>
                            <div className="flex-1 space-y-1.5 overflow-hidden">
                              <Skeleton className="h-4 w-[40%] rounded-md" />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-3xl rounded-3xl shadow-2xl">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-bold tracking-tight">
                Rename Codebase
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Enter a new name for your codebase.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="newName"
                  className="text-[10px] font-bold text-muted-foreground ml-1 uppercase tracking-wider"
                >
                  Name
                </Label>
                <Input
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-secondary/20 h-12 border-border/50 focus-visible:ring-primary/20 rounded-xl px-4 text-sm transition-all"
                  placeholder="New codebase name"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-12 text-xs font-bold border-border/50 hover:bg-secondary/50"
                  onClick={() => setIsRenameDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl h-12 text-xs font-bold bg-white text-black hover:bg-white/90"
                  onClick={handleRename}
                  disabled={
                    isActionLoading ||
                    !newName.trim() ||
                    newName === selectedCodebase?.name
                  }
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-3xl rounded-3xl shadow-2xl">
          <div className="p-8">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-6">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogHeader className="mb-6 text-left">
              <DialogTitle className="text-xl font-bold tracking-tight">
                Delete Codebase
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-bold text-foreground">
                  &quot;{selectedCodebase?.name}&quot;
                </span>
                ? This action cannot be undone and all associated data will be
                removed.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-8">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-12 text-xs font-bold border-border/50 hover:bg-secondary/50"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Keep it
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl h-12 text-xs font-bold shadow-lg shadow-destructive/10"
                onClick={handleDelete}
                disabled={isActionLoading}
              >
                {isActionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Delete Forever"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
