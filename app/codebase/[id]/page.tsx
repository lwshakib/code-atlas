/**
 * CODEBASE DETAILS PAGE
 *
 * This is the primary workspace for interacting with a specific codebase.
 * It features a split-pane layout with an architectural wiki/documentation on the left
 * and an agentic AI chat on the right.
 */

"use client";

import React from "react";
import {
  FileCode,
  MessageSquare,
  Send,
  X,
  Sparkles,
  ArrowUpRight,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { Streamdown } from "streamdown"; // Powerful markdown streamer with plugin support
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import type { BundledLanguage } from "shiki";
import { Mermaid } from "@/components/ai-elements/mermaid-diagram"; // Custom component to render Mermaid.js charts
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block"; // Custom shiki-powered code blocks

import { LogoWithText } from "@/components/Logo";
import { Button } from "@/components/ui/button";

import { UserMenu } from "@/components/UserMenu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/use-chat"; // Custom Vercel AI SDK wrapper for streaming
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message as AIMessage,
  MessageContent,
  MessageResponse,
  ToolCallStatus,
} from "@/components/ai-elements/message";
import { Textarea } from "@/components/ui/textarea";

interface CodebaseDocPageChild {
  id: string;
  title: string;
  content: string;
}

interface CodebaseDocPage {
  id: string;
  title: string;
  content: string;
  children?: CodebaseDocPageChild[];
}

interface CodebaseData {
  id: string;
  docPages: CodebaseDocPage[];
  recommendations?: { text: string }[];
  messages?: unknown[];
}

interface StreamdownCodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node?: any;
}

// Global plugins for the Streamdown markdown engine
const streamdownPlugins = { cjk, code, math };

export default function CodebaseDetailsPage() {
  // 1. PAGE STATE
  const [scrolled, setScrolled] = React.useState(false); // Navigation aesthetic
  const params = useParams();
  const codebaseId = params.id as string;
  const [activePageId, setActivePageId] = React.useState<string | null>(null); // Controls which doc page is rendered
  const [showChat, setShowChat] = React.useState(true); // Toggle visibility of the chat sidebar
  const [codebase, setCodebase] = React.useState<CodebaseData | null>(null); // The full repository metadata/docs
  const [shuffledQuestions, setShuffledQuestions] = React.useState<string[]>(
    [],
  ); // Randomly picked "starting questions"

  const [expandedItems, setExpandedItems] = React.useState<string[]>([]); // Sidebar accordion state
  const [activeTab, setActiveTab] = React.useState<"index" | "docs" | "chat">(
    "docs",
  ); // Mobile tab state

  // 2. CHAT HOOK
  const {
    messages,
    input,
    setInput,
    append,
    isLoading: isChatLoading,
    handleSubmit: handleChatSubmit,
    setMessages,
    stop,
  } = useChat({
    api: `/api/chat/${codebaseId}`, // The unique streaming endpoint for this specific codebase
    initialMessages: [],
  });

  /**
   * DATA FETCHING EFFECT
   * Loads the codebase docs, recommendations, and previous message history on mount.
   */
  React.useEffect(() => {
    const fetchCodebase = async () => {
      try {
        const response = await fetch(`/api/codebases/${codebaseId}`);
        const result = await response.json();
        if (result.success) {
          setCodebase(result.data);
          // Restore chat history if any exists in the database
          if (result.data.messages && result.data.messages.length > 0) {
            setMessages(result.data.messages);
          }
          // Default to the first documentation page
          if (result.data.docPages && result.data.docPages.length > 0) {
            setActivePageId(result.data.docPages[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch codebase:", error);
      }
    };

    if (codebaseId) {
      fetchCodebase();
    }
  }, [codebaseId, setMessages]);

  /**
   * RECOMMENDATION REFRESH EFFECT
   * Picks 3 random suggested questions from the 'recommendations' list whenever chat resets or opens.
   */
  React.useEffect(() => {
    if (showChat && (codebase?.recommendations?.length ?? 0) > 0) {
      const allQuestions = codebase!.recommendations!.map((r) => r.text);
      const shuffled = [...allQuestions]
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShuffledQuestions(shuffled);
    }
  }, [showChat, codebase]);

  /**
   * SIDEBAR TOGGLE
   */
  const toggleItem = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label],
    );
  };

  /**
   * CUSTOM MARKDOWN COMPONENTS (FOR CHAT)
   * Defines how special markdown tokens (code, mermaid) are rendered within chat bubbles.
   */
  const chatStreamdownComponents = {
    code: ({ inline, className, children }: StreamdownCodeProps) => {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : null;
      const codeText = String(children).replace(/\n$/, "");

      // Handle simple inline `code` blocks
      if (inline || !language || !className) {
        return (
          <code
            className={cn(
              "px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm font-medium text-foreground/90 transition-colors hover:bg-muted/80",
              className,
            )}
          >
            {children}
          </code>
        );
      }

      // Handle Mermaid diagrams for visualized architecture
      if (language === "mermaid") {
        return <Mermaid chart={codeText} className="my-6" />;
      }

      // Handle standard code blocks with syntax highlighting and copy buttons
      return (
        <CodeBlock
          code={codeText}
          language={(language || "text") as BundledLanguage}
          className="my-6 border border-border/10 rounded-2xl overflow-hidden shadow-2xl shadow-primary/5"
        >
          <CodeBlockHeader className="bg-secondary/40 border-b border-white/5 px-4 py-2.5 backdrop-blur-sm">
            <CodeBlockTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-primary/50" />
              {language}
            </CodeBlockTitle>
            <CodeBlockActions>
              <CodeBlockCopyButton className="size-7 text-muted-foreground/30 hover:text-primary hover:bg-primary/10 transition-all rounded-lg" />
            </CodeBlockActions>
          </CodeBlockHeader>
        </CodeBlock>
      );
    },
  };

  /**
   * SIDEBAR NAVIGATION HANDLER
   * Scrolls to a specific documentation page or subsection.
   */
  const scrollToSection = (id: string, isPage: boolean) => {
    const container = document.getElementById("content-scroll-container");
    if (!container) return;

    if (isPage) {
      setActivePageId(id);
      container.scrollTo({ top: 0, behavior: "smooth" });
      if (window.innerWidth < 1024) setActiveTab("docs");
      return;
    }

    // Direct scroll for subsection anchors
    const element = document.getElementById(id);
    if (element) {
      const elementPosition = element.offsetTop;
      const offsetPosition = elementPosition - 20;

      container.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      if (window.innerWidth < 1024) setActiveTab("docs");
    }
  };

  /**
   * GLOBAL SCROLL LISTENER
   */
  React.useEffect(() => {
    const container = document.getElementById("content-scroll-container");
    const handleScroll = () => {
      if (container) {
        setScrolled(container.scrollTop > 20);
      }
    };
    container?.addEventListener("scroll", handleScroll);
    return () => container?.removeEventListener("scroll", handleScroll);
  }, []);

  /**
   * CLEAR HISTORY
   * Triggers a PUT request to the API to wipe database messages for this codebase.
   */
  const handleClearChat = async () => {
    try {
      const response = await fetch(`/api/codebases/${codebaseId}`, {
        method: "PUT",
      });
      if (response.ok) {
        setMessages([]); // Sync UI
      }
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  };

  /**
   * RECOMMENDATION HANDLER
   * Automatically appends a message to the chat when a suggestion bubble is clicked.
   */
  const handleQuestionClick = (question: string) => {
    append({ role: "user", content: question });
  };

  /**
   * MESSAGE COPY BUTTON
   */
  const CopyButton = ({
    content,
    isUser,
  }: {
    content: string;
    isUser: boolean;
  }) => {
    const [copied, setCopied] = React.useState(false);
    if (!content) return null;

    const onCopy = async () => {
      try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    };

    return (
      <button
        onClick={onCopy}
        className={cn(
          "mt-1 p-2 rounded-lg hover:bg-secondary/80 text-muted-foreground/30 hover:text-primary transition-all group-hover:opacity-100 opacity-0 cursor-pointer",
          isUser ? "mr-1 self-end" : "ml-1 self-start",
        )}
        title="Copy message"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-primary animate-in zoom-in" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground/90 selection:bg-primary/30 overflow-hidden">
      {/* Navigation */}
      <nav
        className={`w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/80 backdrop-blur-md border-b border-border py-2"
            : "bg-transparent py-2"
        }`}
      >
        <div className="max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <LogoWithText size={28} />
            </Link>
          </div>

          <div className="flex items-center justify-end gap-3 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newShowChat = !showChat;
                setShowChat(newShowChat);
                if (newShowChat && window.innerWidth < 1024) {
                  setActiveTab("chat");
                }
              }}
              className={cn(
                "hidden lg:flex h-9 px-4 rounded-full transition-all",
                showChat
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:bg-secondary/50",
              )}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              <span className="text-xs font-bold">Chat</span>
            </Button>
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* Mobile Tabs */}
      <div className="lg:hidden flex border-b border-border bg-background px-4">
        {[
          { id: "index", label: "Index" },
          { id: "docs", label: "Documentation" },
          { id: "chat", label: "Chat" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setActiveTab(tab.id as any);
              if (tab.id === "chat") setShowChat(true);
            }}
            className={cn(
              "flex-1 py-4 text-xs font-bold transition-all border-b-2",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="flex-1 min-h-0 relative overflow-hidden">
        <div className="absolute inset-0 flex flex-col lg:flex-row gap-8 p-4 lg:p-8 overflow-hidden">
          {/* I. Left Column: On this page / Index (2/12 -> w-64) */}
          <aside
            className={cn(
              "w-full lg:w-64 h-full overflow-y-auto pr-4 custom-scrollbar flex-shrink-0",
              activeTab !== "index" && "hidden lg:block",
            )}
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="pb-2"
            >
              <h3 className="text-sm font-semibold text-foreground mb-6">
                On this page
              </h3>
              <div className="relative border-l-2 border-primary/40 pl-6 space-y-5">
                {codebase?.docPages.map(
                  (section: CodebaseDocPage, idx: number) => {
                    const isExpanded = expandedItems.includes(section.title);
                    const isActive = activePageId === section.id;
                    return (
                      <div key={idx} className="space-y-4">
                        <button
                          onClick={() => {
                            scrollToSection(section.id, true);
                            if ((section.children?.length ?? 0) > 0)
                              toggleItem(section.title);
                          }}
                          className={`block text-left text-[13px] font-bold transition-all duration-300 leading-tight hover:text-primary ${isActive ? "text-primary" : "text-foreground/60"}`}
                        >
                          {section.title}
                        </button>
                        <AnimatePresence initial={false}>
                          {isExpanded &&
                            (section.children?.length ?? 0) > 0 && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden space-y-3 pt-2"
                              >
                                {section.children?.map((sub, sIdx) => (
                                  <button
                                    key={sIdx}
                                    onClick={() =>
                                      scrollToSection(sub.id, false)
                                    }
                                    className="block text-left text-[11px] font-medium text-muted-foreground/60 hover:text-primary transition-colors pl-4 border-l border-border/10 ml-1 py-1"
                                  >
                                    {sub.title}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                        </AnimatePresence>
                      </div>
                    );
                  },
                )}
              </div>
            </motion.div>
          </aside>

          {/* II. Center Column: Main Content (flex-1) */}
          <section
            id="content-scroll-container"
            className={cn(
              "flex-1 h-full overflow-y-auto pr-4 custom-scrollbar pb-32 transition-all duration-500",
              activeTab !== "docs" && "hidden lg:block",
            )}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="p-6 lg:p-16 space-y-24 scroll-smooth"
            >
              {codebase?.docPages
                .filter((page: CodebaseDocPage) => page.id === activePageId)
                .map((section: CodebaseDocPage, sIdx: number) => (
                  <article
                    key={sIdx}
                    id={section.id}
                    className="max-w-none prose prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activePageId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                      >
                        <h1 className="text-3xl lg:text-4xl font-bold tracking-tighter text-foreground mb-10">
                          {section.title}
                        </h1>

                        <div className="text-base text-muted-foreground/80 leading-relaxed mb-12">
                          <Streamdown
                            plugins={streamdownPlugins}
                            components={
                              {
                                code: ({
                                  inline,
                                  className,
                                  children,
                                }: StreamdownCodeProps) => {
                                  const match = /language-(\w+)/.exec(
                                    className || "",
                                  );
                                  const language = match ? match[1] : null;
                                  const codeText = String(children).replace(
                                    /\n$/,
                                    "",
                                  );

                                  if (inline || !language || !className) {
                                    return (
                                      <code
                                        className={cn(
                                          "px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm font-medium text-foreground/90 transition-colors hover:bg-muted/80",
                                          className,
                                        )}
                                      >
                                        {children}
                                      </code>
                                    );
                                  }

                                  if (language === "mermaid") {
                                    return (
                                      <Mermaid
                                        chart={codeText}
                                        className="my-8"
                                      />
                                    );
                                  }

                                  return (
                                    <CodeBlock
                                      code={codeText}
                                      language={
                                        (language || "text") as BundledLanguage
                                      }
                                      className="my-8 border border-border/10 rounded-2xl overflow-hidden shadow-2xl shadow-primary/5"
                                    >
                                      <CodeBlockHeader className="bg-secondary/40 border-b border-border/10 px-4 py-2.5">
                                        <CodeBlockTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
                                          <FileCode className="w-3 h-3" />
                                          {language}
                                        </CodeBlockTitle>
                                        <CodeBlockActions>
                                          <CodeBlockCopyButton className="size-7 text-muted-foreground/30 hover:text-primary transition-all hover:bg-primary/5 rounded-lg" />
                                        </CodeBlockActions>
                                      </CodeBlockHeader>
                                    </CodeBlock>
                                  );
                                },
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              } as any
                            }
                          >
                            {section.content}
                          </Streamdown>
                        </div>

                        {(section.children?.length ?? 0) > 0 && (
                          <div className="space-y-20 mt-20">
                            {section.children?.map(
                              (sub: CodebaseDocPageChild, subIdx: number) => (
                                <div
                                  key={subIdx}
                                  id={sub.id}
                                  className="scroll-mt-32"
                                >
                                  <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground mb-6 border-b border-border/10 pb-4">
                                    {sub.title}
                                  </h2>
                                  <div className="text-sm text-muted-foreground/70 leading-relaxed">
                                    <Streamdown
                                      plugins={streamdownPlugins}
                                      components={
                                        {
                                          code: ({
                                            inline,
                                            className,
                                            children,
                                          }: StreamdownCodeProps) => {
                                            const match = /language-(\w+)/.exec(
                                              className || "",
                                            );
                                            const language = match
                                              ? match[1]
                                              : null;
                                            const codeText = String(
                                              children,
                                            ).replace(/\n$/, "");

                                            if (
                                              inline ||
                                              !language ||
                                              !className
                                            ) {
                                              return (
                                                <code
                                                  className={cn(
                                                    "px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm font-medium text-foreground/90 transition-colors hover:bg-muted/80",
                                                    className,
                                                  )}
                                                >
                                                  {children}
                                                </code>
                                              );
                                            }

                                            if (language === "mermaid") {
                                              return (
                                                <Mermaid
                                                  chart={codeText}
                                                  className="my-8"
                                                />
                                              );
                                            }

                                            return (
                                              <CodeBlock
                                                code={codeText}
                                                language={
                                                  (language ||
                                                    "text") as BundledLanguage
                                                }
                                                className="my-8 border border-border/10 rounded-2xl overflow-hidden shadow-2xl shadow-primary/5"
                                              >
                                                <CodeBlockHeader className="bg-secondary/40 border-b border-border/10 px-4 py-2.5">
                                                  <CodeBlockTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
                                                    <FileCode className="w-3 h-3" />
                                                    {language}
                                                  </CodeBlockTitle>
                                                  <CodeBlockActions>
                                                    <CodeBlockCopyButton className="size-7 text-muted-foreground/30 hover:text-primary transition-all hover:bg-primary/5 rounded-lg" />
                                                  </CodeBlockActions>
                                                </CodeBlockHeader>
                                              </CodeBlock>
                                            );
                                          },
                                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        } as any
                                      }
                                    >
                                      {sub.content}
                                    </Streamdown>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </article>
                ))}
            </motion.div>
          </section>

          {/* III. Right Column: Chat (flex-1 -> lg:w-[450px]) */}
          <AnimatePresence>
            {showChat && (
              <aside
                className={cn(
                  "w-full lg:w-[450px] h-full absolute inset-0 lg:relative z-40 bg-background lg:bg-transparent flex-shrink-0",
                  activeTab !== "chat" && "hidden lg:block",
                )}
              >
                <motion.div
                  key="chat"
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    type: "spring",
                    damping: 25,
                    stiffness: 200,
                  }}
                  className="h-full bg-secondary/10 lg:rounded-[2.5rem] border-l lg:border border-border/30 overflow-hidden flex flex-col relative shadow-2xl shadow-primary/5"
                >
                  {/* Header Actions (Floating) */}
                  <div className="absolute top-6 left-6 z-50">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 rounded-full bg-background/50 backdrop-blur-sm text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent size="sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear History</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete your chat messages.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleClearChat}
                            variant="destructive"
                          >
                            Clear
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Part 1: Scrollable Messages */}
                  <div className="flex-1 min-h-0 relative">
                    <Conversation className="h-full">
                      <ConversationContent className="pt-24 pb-12 px-6">
                        {messages.length === 0 ? (
                          <ConversationEmptyState
                            icon={
                              <Sparkles className="w-10 h-10 text-primary/40 mb-2" />
                            }
                            title="Ask anything about this codebase"
                            description="I can help you understand the architecture, find specific logic, or explain dependencies."
                          />
                        ) : (
                          messages.map((m) => (
                            <AIMessage key={m.id} from={m.role}>
                              <MessageContent
                                className={cn(
                                  m.role === "user"
                                    ? "rounded-3xl bg-primary text-primary-foreground p-5"
                                    : "rounded-none bg-transparent border-none p-0",
                                )}
                              >
                                {m.role === "assistant" ? (
                                  <div className="space-y-4">
                                    <MessageResponse
                                      components={chatStreamdownComponents}
                                    >
                                      {m.content}
                                    </MessageResponse>
                                    <ToolCallStatus
                                      toolInvocations={m.toolInvocations}
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm leading-relaxed">
                                      {m.content}
                                    </p>
                                  </>
                                )}
                              </MessageContent>
                              {m.role === "user" && (
                                <CopyButton content={m.content} isUser={true} />
                              )}
                              {m.role === "assistant" && (
                                <CopyButton
                                  content={m.content}
                                  isUser={false}
                                />
                              )}
                            </AIMessage>
                          ))
                        )}
                      </ConversationContent>
                      <ConversationScrollButton />
                    </Conversation>
                  </div>

                  {/* Part 2: Static Input Area */}
                  <div className="px-6 pt-4 space-y-4 pb-2 flex-shrink-0 border-t border-border/10">
                    {messages.length === 0 && (
                      <div className="flex flex-col gap-2 mb-4">
                        {shuffledQuestions.map((query, index) => (
                          <button
                            key={index}
                            onClick={() => handleQuestionClick(query)}
                            className="w-full text-left px-4 py-3 rounded-2xl border border-primary/10 text-[11px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-between group shadow-sm shadow-primary/5"
                          >
                            <span className="truncate mr-4">{query}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!input.trim() || isChatLoading) return;
                        await handleChatSubmit(
                          e as unknown as React.FormEvent<HTMLFormElement>,
                        );
                      }}
                      className="relative"
                    >
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            const form = e.currentTarget.form;
                            if (form) form.requestSubmit();
                          }
                        }}
                        placeholder="Ask about this repository..."
                        className="min-h-[100px] max-h-48 bg-background/50 backdrop-blur-sm border-border/10 focus-visible:ring-primary/20 rounded-2xl pr-14 py-4 resize-none shadow-xl shadow-primary/5"
                      />
                      <Button
                        type={isChatLoading ? "button" : "submit"}
                        onClick={isChatLoading ? stop : undefined}
                        disabled={!input.trim() && !isChatLoading}
                        size="icon"
                        className={cn(
                          "absolute right-3 bottom-3 size-9 rounded-xl transition-all shadow-lg",
                          isChatLoading
                            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-destructive/20"
                            : "bg-primary text-primary-foreground hover:opacity-90 shadow-primary/20",
                        )}
                      >
                        {isChatLoading ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </form>
                  </div>
                </motion.div>
              </aside>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
