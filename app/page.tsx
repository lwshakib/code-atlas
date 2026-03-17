"use client";

import { Search } from "lucide-react";
import { LogoWithText } from "@/components/Logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Input } from "@/components/ui/input";
import * as motion from "motion/react-client";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans transition-colors duration-300 dark:bg-black">
      <header className="fixed top-0 z-50 w-full bg-white/5 backdrop-blur-md dark:bg-black/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <LogoWithText size={28} />
          <ModeToggle />
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-40">
        {/* Background Glows */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] bg-blue-500/20 blur-[150px] dark:bg-blue-600/30" />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-full bg-gradient-to-t from-blue-500/5 to-transparent blur-3xl opacity-50" />

        <div className="relative z-10 flex w-full max-w-5xl flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-4 text-8xl font-black tracking-tighter text-black dark:text-white sm:text-9xl"
          >
            Code Atlas
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="mb-14 flex flex-col gap-1 text-center"
          >
            <p className="text-xl font-medium tracking-tight text-blue-600/90 dark:text-blue-400/90 sm:text-2xl">
              A new perspective on development for the agentic era.
            </p>
            <p className="text-xl font-medium tracking-tight text-blue-600/90 dark:text-blue-400/90 sm:text-2xl">
              Gemini-generated documentation, always up-to-date.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="relative w-full max-w-2xl group"
          >
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600/20 to-cyan-600/20 opacity-0 blur-xl transition duration-500 group-hover:opacity-100 group-focus-within:opacity-100" />
            <div className="relative flex items-center">
              <Input
                placeholder="Find open source repos"
                className="h-16 w-full rounded-full border-zinc-200 bg-white/80 px-10 text-xl backdrop-blur-sm transition-all placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:placeholder:text-zinc-500 dark:focus-visible:border-blue-500/50"
              />
              <div className="absolute right-6 flex items-center justify-center">
                <Search className="h-6 w-6 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}