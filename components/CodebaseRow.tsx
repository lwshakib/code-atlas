/**
 * CODEBASE ROW COMPONENT
 *
 * Renders a single entry in the dashboard's codebase table.
 * Crucially, it subscribes to 'Inngest Realtime' events for this specific codebase
 * to automatically update its status (e.g., INDEXING -> COMPLETED) without page refreshes.
 */

"use client";

import React from "react";
import {
  Github,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useInngestSubscription } from "@inngest/realtime/hooks"; // Real-time hook for listening to background job status
import {
  fetchRealtimeSubscriptionToken,
  cancelAndCleanupIndexingAction,
  retryIndexingAction,
} from "@/actions/codebases";
import { toast } from "sonner";

interface Codebase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  status: string;
}

interface CodebaseRowProps {
  codebase: Codebase;
  onRename: (cb: Codebase) => void;
  onDelete: (cb: Codebase) => void;
  removeCodebase: (id: string) => void;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function CodebaseRow({
  codebase,
  onRename,
  onDelete,
  removeCodebase,
  onStatusChange,
}: CodebaseRowProps) {
  // 1. LOCAL TRACKING OF THE CURRENT STATUS
  const [currentStatus, setCurrentStatus] = React.useState(codebase.status);
  const [isActionLoading, setIsActionLoading] = React.useState(false);

  /**
   * INNGEST REALTIME SUBSCRIPTION
   * Connects to the Inngest event stream for this specific repository.
   * Uses 'fetchRealtimeSubscriptionToken' to get a scoped JWT for secure web-socket listening.
   */
  const { latestData } = useInngestSubscription({
    refreshToken: () => fetchRealtimeSubscriptionToken(codebase.id),
  });

  /**
   * STATUS SYNC EFFECT
   * Updates the UI whenever a new 'status' event is pushed from the server.
   */
  React.useEffect(() => {
    if (latestData?.data?.status) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentStatus(latestData.data.status);
      onStatusChange?.(codebase.id, latestData.data.status); // Inform parent about the update
    }
  }, [latestData, codebase.id, onStatusChange]);

  /**
   * CANCEL HANDLER
   * Triggers a server action to halt the Inngest run and remove partial artifacts from the system.
   */
  const handleCancel = async () => {
    setIsActionLoading(true);
    const promise = cancelAndCleanupIndexingAction(codebase.id); // Trigger multi-modal cleanup (Postgres/Neo4j/etc)

    // Show a dynamic toast that reflects the promise state
    toast.promise(promise, {
      loading: "Cancelling and cleaning up...",
      success: "Indexing cancelled and codebase removed",
      error: (err) => err.message || "Failed to cancel indexing",
    });

    try {
      const result = await promise;
      if (result.success) {
        removeCodebase(codebase.id); // Remove from the dashboard UI immediately
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * RETRY HANDLER
   * Restarts the indexing process for a failed repo.
   */
  const handleRetry = async () => {
    setIsActionLoading(true);
    const promise = retryIndexingAction(codebase.id);

    toast.promise(promise, {
      loading: "Restarting indexing...",
      success: "Indexing restarted",
      error: (err) => err.message || "Failed to restart indexing",
    });

    try {
      const result = await promise;
      if (result.success) {
        setCurrentStatus("PENDING"); // Reset local status to pending to update UI states
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <TableRow className="border-b border-border/50 hover:bg-secondary/10 transition-colors group">
      <TableCell className="py-4 align-middle">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-background border border-border/50 flex items-center justify-center shadow-sm shrink-0">
            <Github className="w-4 h-4 text-primary/70" />
          </div>
          {currentStatus === "COMPLETED" ? (
            <Link
              href={`/codebase/${codebase.id}`}
              className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors cursor-pointer truncate"
            >
              {codebase.name}
            </Link>
          ) : (
            <span
              className="font-bold text-sm tracking-tight text-muted-foreground opacity-80 cursor-default truncate"
              title="Indexing not completed"
            >
              {codebase.name}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-4 align-middle">
        <p
          className="text-xs text-muted-foreground line-clamp-1"
          title={codebase.description || "No description provided."}
        >
          {codebase.description
            ? codebase.description.split(" ").slice(0, 10).join(" ") +
              (codebase.description.split(" ").length > 10 ? "..." : "")
            : "No description provided."}
        </p>
      </TableCell>
      <TableCell className="py-4 align-middle text-right">
        <span className="text-[10px] font-medium text-muted-foreground/60">
          {formatDistanceToNow(new Date(codebase.createdAt), {
            addSuffix: true,
          })}
        </span>
      </TableCell>
      <TableCell className="py-4 align-middle text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Pending or Indexing: Show simple Cancel (X) icon */}
          {(currentStatus === "PENDING" || currentStatus === "INDEXING") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              onClick={handleCancel}
              disabled={isActionLoading}
              title="Cancel Indexing"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          {/* Failed: Show Retry and Delete buttons */}
          {currentStatus === "FAILED" && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-[10px] font-bold gap-1 border-border/50"
                onClick={handleRetry}
                disabled={isActionLoading}
              >
                <RefreshCw
                  className={`w-3 h-3 ${isActionLoading ? "animate-spin" : ""}`}
                />
                Retry
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(codebase)}
                disabled={isActionLoading}
                title="Delete Codebase"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Completed: Show Three-dot action button */}
          {currentStatus === "COMPLETED" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 p-1 border-border/50 bg-background/95 backdrop-blur-xl"
              >
                <DropdownMenuItem
                  className="cursor-pointer rounded-md focus:bg-secondary/80 py-2"
                  onClick={() => onRename(codebase)}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5 opacity-70" />
                  <span className="text-xs font-medium">Rename</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-md py-2"
                  onClick={() => onDelete(codebase)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5 opacity-70" />
                  <span className="text-xs font-medium">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
