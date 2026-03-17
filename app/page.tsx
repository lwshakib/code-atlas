"use client";

import { useRef, useLayoutEffect } from "react";
import { Search, BookOpen, Code, MessageSquare, Monitor } from "lucide-react";
import { LogoWithText } from "@/components/Logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Input } from "@/components/ui/input";
import * as motion from "motion/react-client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const card4Ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current || !cubeRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 20%",
          end: "+=1500",
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });

      // Initial entrance animation
      tl.fromTo([card1Ref.current, card2Ref.current, card3Ref.current, card4Ref.current], {
        opacity: 0,
        scale: 0.5,
      }, {
        opacity: 1,
        scale: 1,
        stagger: 0.1,
        duration: 1,
        ease: "back.out(1.7)",
      }, 0)
      
      // Hero state (staggered)
      .to(card1Ref.current, { x: -380, y: -50, rotate: -5, duration: 1 }, 0.5)
      .to(card2Ref.current, { x: -100, y: 100, rotate: 3, duration: 1 }, 0.5)
      .to(card3Ref.current, { x: 220, y: -120, rotate: 5, duration: 1 }, 0.5)
      .to(card4Ref.current, { x: 440, y: 60, rotate: -3, duration: 1 }, 0.5)

      // Transform into Cube
      .to([card1Ref.current, card2Ref.current, card3Ref.current, card4Ref.current], {
        x: 0,
        y: 0,
        rotate: 0,
        duration: 1,
        ease: "power2.inOut",
      }, "+=0.2")
      .to(card1Ref.current, { transform: "rotateY(-90deg) translateZ(160px)", duration: 1.5 }, "+=0.1")
      .to(card2Ref.current, { transform: "rotateY(0deg) translateZ(160px)", duration: 1.5 }, "<")
      .to(card3Ref.current, { transform: "rotateY(180deg) translateZ(160px)", duration: 1.5 }, "<")
      .to(card4Ref.current, { transform: "rotateY(90deg) translateZ(160px)", duration: 1.5 }, "<")
      .to(".cube-face-cap", { opacity: 0.4, duration: 1 }, "<")
      
      // Rotate Cube
      .to(cubeRef.current, {
        rotateY: 360 + 45,
        rotateX: -25,
        duration: 4,
        ease: "none",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

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
        <div 
          ref={containerRef}
          className="relative mt-32 flex h-screen w-full items-center justify-center overflow-visible perspective-2000"
        >
          <div 
            ref={cubeRef}
            className="relative h-[320px] w-[320px] preserve-3d"
          >
            {/* Card 1: Book (Cube Left Face) */}
            <div 
              ref={card1Ref}
              className="absolute inset-0 preserve-3d backface-visible opacity-0"
            >
              <div className="relative h-full w-full rounded-sm border-[2px] border-blue-400 bg-blue-600/15 shadow-[0_0_20px_rgba(59,130,246,0.3)] backdrop-blur-xl flex items-center justify-center">
                <BookOpen className="h-24 w-24 text-blue-300 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                <div className="absolute inset-2 border-[0.5px] border-blue-400/20" />
              </div>
            </div>

            {/* Card 2: Code (Cube Front Face) */}
            <div 
              ref={card2Ref}
              className="absolute inset-0 preserve-3d backface-visible opacity-0"
            >
              <div className="relative h-full w-full rounded-sm border-[2.5px] border-blue-400 bg-blue-600/25 shadow-[0_0_40px_rgba(59,130,246,0.4)] backdrop-blur-2xl flex items-center justify-center">
                <Code className="h-32 w-32 text-blue-200 drop-shadow-[0_0_20px_rgba(59,130,246,0.7)]" />
                <div className="absolute inset-2 border-[0.5px] border-blue-400/20" />
              </div>
            </div>

            {/* Card 3: Chat (Cube Back Face) */}
            <div 
              ref={card3Ref}
              className="absolute inset-0 preserve-3d backface-visible opacity-0"
            >
              <div className="relative h-full w-full rounded-sm border-[2px] border-blue-400 bg-blue-600/15 shadow-[0_0_20px_rgba(59,130,246,0.3)] backdrop-blur-md flex items-center justify-center">
                <MessageSquare className="h-20 w-20 text-blue-300 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                <div className="absolute inset-2 border-[0.5px] border-blue-400/20" />
              </div>
            </div>

            {/* Card 4: Monitor (Cube Right Face) */}
            <div 
              ref={card4Ref}
              className="absolute inset-0 preserve-3d backface-visible opacity-0"
            >
              <div className="relative h-full w-full rounded-sm border-[2px] border-blue-400 bg-blue-600/20 shadow-[0_0_30px_rgba(59,130,246,0.3)] backdrop-blur-2xl flex items-center justify-center">
                <Monitor className="h-28 w-28 text-blue-200 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                <div className="absolute inset-2 border-[0.5px] border-blue-400/20" />
              </div>
            </div>

            {/* Cap Faces */}
            <div 
              className="cube-face-cap absolute inset-0 opacity-0 preserve-3d backface-visible"
              style={{ transform: "rotateX(90deg) translateZ(160px)" }}
            >
              <div className="h-full w-full border-[1.5px] border-blue-400/50 bg-blue-600/10 backdrop-blur-sm" />
            </div>
            <div 
              className="cube-face-cap absolute inset-0 opacity-0 preserve-3d backface-visible"
              style={{ transform: "rotateX(-90deg) translateZ(160px)" }}
            >
              <div className="h-full w-full border-[1.5px] border-blue-400/50 bg-blue-600/10 backdrop-blur-sm" />
            </div>
          </div>

          {/* Environmental Glow */}
          <div className="pointer-events-none absolute h-[700px] w-[900px] rounded-full bg-blue-600/10 blur-[200px] dark:bg-blue-600/20" />
        </div>

        {/* Spacer for scroll */}
        <div className="h-[100vh]" />


      </main>


    </div>
  );
}
