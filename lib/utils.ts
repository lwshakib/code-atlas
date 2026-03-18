/**
 * UI UTILITY: cn()
 * 
 * A helper function to merge Tailwind CSS classes conditionally.
 * It uses 'clsx' to handle conditional strings and 'tailwind-merge' 
 * to ensure that conflicting classes (like p-2 vs p-4) are resolved correctly.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

