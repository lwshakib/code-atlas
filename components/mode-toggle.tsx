/**
 * MODE TOGGLE COMPONENT
 * 
 * A simple button to switch between light and dark themes. 
 * Uses 'next-themes' to inject the appropriate class into the <html> element.
 */

"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      // Toggle logic: switches to 'dark' if current is 'light', and vice versa.
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="rounded-full"
    >
      {/* Sun Icon: Visible in light mode, rotates and scales out in dark mode */}
      <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      
      {/* Moon Icon: Absolute positioned, scales in and rotates into view in dark mode */}
      <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

