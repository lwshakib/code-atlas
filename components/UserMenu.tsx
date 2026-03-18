/**
 * USER MENU COMPONENT
 *
 * Displays the current user's profile picture and provides a dropdown menu
 * for navigation and account management. Integrated with Better Auth.
 */

"use client";

import React from "react";
import { LogOut, User, Bell, CreditCard, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client"; // Better Auth client-side utilities
import { useRouter } from "next/navigation";

export function UserMenu() {
  /**
   * SESSION HOOK
   * Automatically refreshes and provides user metadata (name, email, image).
   */
  const { data: session } = authClient.useSession();
  const router = useRouter();

  // Guard: Don't render if the user is unauthenticated
  if (!session) return null;

  /**
   * SIGN OUT HANDLER
   * Triggers the Better Auth sign-out flow and refreshes the current route to update UI state.
   */
  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.refresh(); // Ensure the layout/server-components reload their auth state
        },
      },
    });
  };

  return (
    <DropdownMenu>
      {/* TRIGGER: The clickable user avatar */}
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="size-9 p-0 rounded-full overflow-hidden border border-border/50 hover:bg-secondary/50 transition-all hover:scale-105 active:scale-95"
        >
          <Avatar className="h-full w-full">
            <AvatarImage
              src={session.user.image || ""}
              alt={session.user.name || "User"}
            />
            {/* Fallback: First letter of user's name */}
            <AvatarFallback className="text-xs bg-primary/10">
              {session.user.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      {/* DROPDOWN CONTENT */}
      <DropdownMenuContent
        align="end"
        className="w-64 mt-2 p-1.5 border-border/50 backdrop-blur-xl bg-background/95 shadow-2xl"
      >
        {/* User identification info */}
        <DropdownMenuLabel className="font-normal px-2 py-2">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none">
              {session.user.name}
            </p>
            <p className="text-[11px] leading-none text-muted-foreground">
              {session.user.email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border/50" />

        {/* Navigation Section */}
        <DropdownMenuItem
          onClick={() => router.push("/codebase")}
          className="cursor-pointer rounded-md focus:bg-secondary/80 py-2.5"
        >
          <Code2 className="mr-2 h-4 w-4 opacity-70" />
          <span className="text-sm font-medium">Codebases</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer rounded-md focus:bg-secondary/80 py-2.5">
          <User className="mr-2 h-4 w-4 opacity-70" />
          <span className="text-sm font-medium">Account Settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer rounded-md focus:bg-secondary/80 py-2.5">
          <Bell className="mr-2 h-4 w-4 opacity-70" />
          <span className="text-sm font-medium">Notifications</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer rounded-md focus:bg-secondary/80 py-2.5">
          <CreditCard className="mr-2 h-4 w-4 opacity-70" />
          <span className="text-sm font-medium">Billing</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border/50" />

        {/* Danger Zone: Log Out */}
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-md py-2.5"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4 opacity-70" />
          <span className="text-sm font-medium">Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
