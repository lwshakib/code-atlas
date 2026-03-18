/**
 * ROOT LAYOUT
 * 
 * This is the top-level layout component that wraps every page in the application.
 * It manages global styles, fonts, SEO metadata, and structural providers (Theme, Tooltip, Toast).
 */

import type { Metadata } from "next";
import "./globals.css"; // Global CSS resets and Tailwind imports
import { ThemeProvider } from "@/components/theme-provider"; // Next-Themes wrapper for dark/light mode
import { TooltipProvider } from "@/components/ui/tooltip"; // Radix UI provider for accessible tooltips
import { Toaster } from "@/components/ui/sonner"; // Sonner notification system

/**
 * GLOBAL SEO METADATA
 * Configures the page title, description, and comprehensive favicon/manifest support.
 */
export const metadata: Metadata = {
  title: "Code Atlas | Map Your Codebase",
  description: "The ultimate platform for code visualization, navigation, and understanding. Map your codebase and explore relationships between files, functions, and modules.",
  icons: {
    icon: [
      { url: "/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon_io/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/favicon_io/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon_io/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/favicon_io/apple-touch-icon.png",
  },
  manifest: "/favicon_io/site.webmanifest",
};

/**
 * ROOT LAYOUT COMPONENT
 * @param children - The active page content
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is used because next-themes modifies the <html> class on the client
    <html lang="en" suppressHydrationWarning>
      <body className={`antialiased`}>
        {/* ThemeProvider: Manages CSS variable injection for dark mode */}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark" // Hardcoded to dark for the Premium Obsidian aesthetic
          disableTransitionOnChange
        >
          {/* TooltipProvider: Required wrapper for all Radix Tooltip components */}
          <TooltipProvider>
            {/* The main page content */}
            {children}
          </TooltipProvider>

          {/* Toaster: Global container for toast notifications (Success/Error/Loading) */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

