"use client";

import { Search, BookOpen, Code, MessageSquare, Monitor } from "lucide-react";
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
            {/* Input Outer Glow */}
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

        {/* Feature Cards Section */}
        <div className="relative mt-12 flex h-[500px] w-full max-w-6xl items-center justify-center overflow-visible">
          {/* Card 1: Book */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, x: -300, y: -20 }}
            animate={{ opacity: 1, scale: 1, x: -280, y: -30 }}
            transition={{ duration: 1, delay: 0.6, ease: "circOut" }}
            className="absolute z-10"
          >
            <div className="group relative flex h-52 w-52 items-center justify-center rounded-sm border border-blue-200 bg-white/40 shadow-[0_0_20px_rgba(59,130,246,0.05)] backdrop-blur-xl rotate-[-1deg] transition-all hover:border-blue-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] dark:border-blue-500/40 dark:bg-zinc-950/40 dark:shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <BookOpen className="h-16 w-16 text-blue-600/70 transition-transform group-hover:scale-110 dark:text-blue-400/80" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-500/5 to-transparent" />
            </div>
          </motion.div>

          {/* Card 2: Code */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, x: -100, y: 60 }}
            animate={{ opacity: 1, scale: 1, x: -80, y: 80 }}
            transition={{ duration: 1, delay: 0.8, ease: "circOut" }}
            className="absolute z-30"
          >
            <div className="group relative flex h-64 w-64 items-center justify-center rounded-sm border border-blue-300 bg-white/60 shadow-[0_0_40px_rgba(59,130,246,0.15)] backdrop-blur-2xl rotate-[0.5deg] transition-all hover:border-blue-500 hover:shadow-[0_0_60px_rgba(59,130,246,0.25)] dark:border-blue-500/60 dark:bg-zinc-950/60 dark:shadow-[0_0_40px_rgba(59,130,246,0.2)]">
              <Code className="h-24 w-24 text-blue-600 transition-transform group-hover:scale-110 dark:text-blue-400" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent" />
            </div>
          </motion.div>

          {/* Card 3: Chat */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, x: 120, y: -60 }}
            animate={{ opacity: 1, scale: 1, x: 140, y: -80 }}
            transition={{ duration: 1, delay: 1, ease: "circOut" }}
            className="absolute z-10"
          >
            <div className="group relative flex h-48 w-48 items-center justify-center rounded-sm border border-blue-200 bg-white/30 shadow-[0_0_20px_rgba(59,130,246,0.05)] backdrop-blur-md rotate-[1deg] transition-all hover:border-blue-300 dark:border-blue-500/40 dark:bg-zinc-950/30">
              <MessageSquare className="h-14 w-14 text-blue-600/60 transition-transform group-hover:scale-110 dark:text-blue-400/70" />
            </div>
          </motion.div>

          {/* Card 4: Monitor */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, x: 280, y: 20 }}
            animate={{ opacity: 1, scale: 1, x: 320, y: 30 }}
            transition={{ duration: 1, delay: 1.2, ease: "circOut" }}
            className="absolute z-20"
          >
            <div className="group relative flex h-60 w-60 items-center justify-center rounded-sm border border-blue-300 bg-white/50 shadow-[0_0_40px_rgba(59,130,246,0.15)] backdrop-blur-2xl rotate-[-0.5deg] transition-all hover:border-blue-500 hover:shadow-[0_0_50px_rgba(59,130,246,0.3)] dark:border-blue-600/50 dark:bg-zinc-950/50 dark:shadow-[0_0_40px_rgba(59,130,246,0.2)]">
              <Monitor className="h-20 w-20 text-blue-600 transition-transform group-hover:scale-110 dark:text-blue-400" />
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 via-transparent to-transparent" />
            </div>
          </motion.div>

          {/* Central Glow Background */}
          <div className="pointer-events-none absolute h-[400px] w-[600px] rounded-full bg-blue-600/5 blur-[120px] dark:bg-blue-600/10" />
        </div>

      </main>


    </div>
  );
}
