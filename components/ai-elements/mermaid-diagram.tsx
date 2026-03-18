"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface MermaidProps {
  chart: string;
  className?: string;
}

export const Mermaid = ({ chart, className }: MermaidProps) => {
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string>("");
  const [isRendering, setIsRendering] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize mermaid with Shadcn-like theme configuration
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "neutral",
      themeVariables: {
        fontFamily: "Inter, sans-serif",
        primaryColor: theme === "dark" ? "#fafafa" : "#18181b",
        primaryTextColor: theme === "dark" ? "#fafafa" : "#18181b",
        primaryBorderColor: theme === "dark" ? "#27272a" : "#e4e4e7",
        lineColor: theme === "dark" ? "#71717a" : "#a1a1aa",
        secondaryColor: theme === "dark" ? "#27272a" : "#f4f4f5",
        tertiaryColor: theme === "dark" ? "#18181b" : "#ffffff",
      },
      securityLevel: "loose",
    });

    const renderChart = async () => {
      if (!chart) return;
      setIsRendering(true);
      try {
        const id = `mermaid-chart-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
      } catch (error) {
        console.error("Mermaid rendering failed:", error);
      } finally {
        setIsRendering(false);
      }
    };

    renderChart();
  }, [chart, theme]);

  return (
    <div 
      className={cn(
        "relative rounded-xl border border-border bg-card/50 p-6 flex items-center justify-center min-h-[100px] overflow-hidden group/mermaid shadow-lg shadow-black/20",
        className
      )}
      ref={containerRef}
    >
      {isRendering ? (
        <div className="flex items-center gap-2 text-muted-foreground animate-in fade-in duration-500">
          <Loader2 className="h-4 h-4 animate-spin" />
          <span className="text-xs font-medium uppercase tracking-widest">Generating Diagram...</span>
        </div>
      ) : (
        <div 
          className="w-full h-full flex justify-center animate-in zoom-in-95 fade-in duration-300 [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }} 
        />
      )}
    </div>
  );
};
