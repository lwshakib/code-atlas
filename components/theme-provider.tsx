/**
 * THEME PROVIDER
 * 
 * A wrapper around the 'next-themes' Provider.
 * This component is necessary because 'next-themes' uses client-side hooks,
 * so it must be marked as "use client".
 */

"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  // Pass through all props (attribute, defaultTheme, enableSystem, etc.) to the underlying provider
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}