"use client";

import React from 'react';
import { 
  Github, 
  LogOut, 
  User, 
  Settings, 
  LayoutDashboard,
  Search,
  FileCode,
  FolderOpen,
  ChevronRight,
  Info,
  Calendar,
  Code2,
  GitBranch,
  Star,
  Eye,
  Activity,
  ArrowLeft,
  Share2,
  ExternalLink,
  MoreHorizontal,
  Zap,
  MessageSquare,
  Send,
  X,
  Sparkles,
  ArrowUpRight,
  Plus,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { Mermaid } from "@/components/ai-elements/mermaid-diagram";
import { 
  CodeBlock, 
  CodeBlockHeader, 
  CodeBlockTitle,
  CodeBlockActions, 
  CodeBlockCopyButton,
  CodeBlockContainer
} from "@/components/ai-elements/code-block";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { LogoWithText } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { 
  Avatar, 
  AvatarImage, 
  AvatarFallback 
} from '@/components/ui/avatar';
import { UserMenu } from '@/components/UserMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InputGroup } from '@/components/ui/input-group';
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
import { authClient } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/use-chat';
import { 
  Conversation, 
  ConversationContent, 
  ConversationScrollButton,
  ConversationEmptyState
} from '@/components/ai-elements/conversation';
import { 
  Message as AIMessage, 
  MessageContent, 
  MessageResponse,
  ToolCallStatus
} from '@/components/ai-elements/message';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const streamdownPlugins = { cjk, code, math };

export default function CodebaseDetailsPage() {
  const [scrolled, setScrolled] = React.useState(false);
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const params = useParams();
  const codebaseId = params.id as string;
  const [activePageId, setActivePageId] = React.useState<string | null>(null);
  const [showChat, setShowChat] = React.useState(true);
  
  const [codebase, setCodebase] = React.useState<any>(null);
  const [shuffledQuestions, setShuffledQuestions] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch codebase data
  React.useEffect(() => {
    const fetchCodebase = async () => {
      try {
        const response = await fetch(`/api/codebases/${codebaseId}`);
        const result = await response.json();
        if (result.success) {
          setCodebase(result.data);
          if (result.data.messages && result.data.messages.length > 0) {
            setMessages(result.data.messages);
          }
          if (result.data.docPages && result.data.docPages.length > 0) {
            setActivePageId(result.data.docPages[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch codebase:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (codebaseId) {
      fetchCodebase();
    }
  }, [codebaseId]);

  // Shuffle questions when chat opens
  React.useEffect(() => {
    if (showChat && codebase?.recommendations?.length > 0) {
      const allQuestions = codebase.recommendations.map((r: any) => r.text);
      const shuffled = [...allQuestions]
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      setShuffledQuestions(shuffled);
    }
  }, [showChat, codebase]);

  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const toggleItem = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const chatStreamdownComponents = {
    code: ({ inline, className, children }: any) => {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : null;
      const codeText = String(children).replace(/\n$/, "");

      if (inline || !language || !className) {
        return (
          <code className={cn("px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm font-medium text-foreground/90 transition-colors hover:bg-muted/80", className)}>
            {children}
          </code>
        );
      }

      if (language === "mermaid") {
        return <Mermaid chart={codeText} className="my-6" />;
      }

      return (
        <CodeBlock 
          code={codeText} 
          language={language as any}
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
    }
  };

  const scrollToSection = (id: string, isPage: boolean) => {
    if (isPage) {
      setActivePageId(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Scroll to subsection
    const element = document.getElementById(id);
    if (element) {
      const navHeight = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { 
    messages, 
    input, 
    setInput, 
    append, 
    isLoading: isChatLoading, 
    handleSubmit: handleChatSubmit,
    setMessages,
    stop 
  } = useChat({
    api: `/api/chat/${codebaseId}`,
    initialMessages: [],
  });

  const handleClearChat = async () => {
    try {
      const response = await fetch(`/api/codebases/${codebaseId}`, {
        method: "PUT",
      });
      if (response.ok) {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  };

  const handleQuestionClick = (question: string) => {
    append({ role: 'user', content: question });
  };

  const CopyButton = ({ content, isUser }: { content: string; isUser: boolean }) => {
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
          isUser ? "mr-1 self-end" : "ml-1 self-start"
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
    <div className="min-h-screen bg-background text-foreground/90 selection:bg-primary/30">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-background/80 backdrop-blur-md border-b border-border py-2' : 'bg-transparent py-2'
      }`}>
        <div className="max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="/">
              <LogoWithText size={28} />
            </a>
          </div>



          <div className="flex items-center justify-end gap-3 ml-auto">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowChat(!showChat)}
              className={`h-9 px-4 rounded-full transition-all ${showChat ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-secondary/50'}`}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              <span className="text-xs font-bold">Chat</span>
            </Button>
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="pt-24 px-8 max-w-full mx-auto pb-12">
        <div className="grid grid-cols-12 gap-8">
          
          {/* I. Left Column: On this page / Index (2/12) */}
          <aside className="col-span-12 lg:col-span-2 space-y-8 sticky top-24 self-start">
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ duration: 0.4 }}
            >
              <h3 className="text-sm font-semibold text-foreground mb-6">On this page</h3>
              <div className="relative border-l-2 border-primary/40 pl-6 space-y-5">
                {codebase?.docPages.map((section: any, idx: number) => {
                  const isExpanded = expandedItems.includes(section.title);
                  const isActive = activePageId === section.id;
                  return (
                    <div key={idx} className="space-y-4">
                      <button 
                        onClick={() => {
                          scrollToSection(section.id, true);
                          if (section.children?.length > 0) toggleItem(section.title);
                        }}
                        className={`block text-left text-[13px] font-bold transition-all duration-300 leading-tight hover:text-primary ${isActive ? 'text-primary' : 'text-foreground/60'}`}
                      >
                        {section.title}
                      </button>
                      <AnimatePresence initial={false}>
                        {section.children?.length > 0 && isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="pl-8 flex flex-col gap-4 pt-4 pb-2">
                              {section.children.map((child: any, cIdx: number) => (
                                <button 
                                  key={cIdx} 
                                  onClick={() => scrollToSection(child.id, false)}
                                  className="block text-left text-[12px] font-bold text-foreground/40 hover:text-primary transition-colors leading-tight"
                                >
                                  {child.title}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>


          </aside>

          {/* II. Center Column: Main Content (6/12 or 10/12) */}
          <section className={`col-span-12 transition-all duration-500 ease-in-out ${showChat ? 'lg:col-span-6' : 'lg:col-span-10'} space-y-6`}>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-background/20 rounded-[2.5rem] border border-border/30 p-12 lg:p-16 h-full shadow-2xl shadow-primary/5 space-y-24 scroll-smooth"
            >
              {codebase?.docPages
                .filter((page: any) => page.id === activePageId)
                .map((section: any, sIdx: number) => (
                <article key={sIdx} id={section.id} className="max-w-none prose prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activePageId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <h1 className="text-4xl font-bold tracking-tighter text-foreground mb-10">{section.title}</h1>
                      
                      <div className="text-base text-muted-foreground/80 leading-relaxed mb-12">
                        <Streamdown 
                          plugins={streamdownPlugins}
                          components={{
                            code: ({ inline, className, children }: any) => {
                              const match = /language-(\w+)/.exec(className || "");
                              const language = match ? match[1] : null;
                              const codeText = String(children).replace(/\n$/, "");

                              if (inline || !language || !className) {
                                return (
                                  <code className={cn("px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm font-medium text-foreground/90 transition-colors hover:bg-muted/80", className)}>
                                    {children}
                                  </code>
                                );
                              }

                              if (language === "mermaid") {
                                return <Mermaid chart={codeText} className="my-8" />;
                              }

                              return (
                                <CodeBlock 
                                  code={codeText} 
                                  language={language as any}
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
                            }
                          }}
                        >
                          {section.content}
                        </Streamdown>
                      </div>

                      {section.children?.length > 0 && (
                        <div className="space-y-20 mt-20">
                          {section.children.map((sub: any, subIdx: number) => (
                            <div key={subIdx} id={sub.id} className="scroll-mt-32">
                              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6 border-b border-border/10 pb-4">
                                {sub.title}
                              </h2>
                              <div className="text-sm text-muted-foreground/70 leading-relaxed">
                                <Streamdown 
                                  plugins={streamdownPlugins}
                                  components={{
                                    code: ({ inline, className, children }: any) => {
                                      const match = /language-(\w+)/.exec(className || "");
                                      const language = match ? match[1] : null;
                                      const codeText = String(children).replace(/\n$/, "");

                                      if (inline || !language || !className) {
                                        return (
                                          <code className={cn("px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm font-medium text-foreground/90 transition-colors hover:bg-muted/80", className)}>
                                            {children}
                                          </code>
                                        );
                                      }

                                      if (language === "mermaid") {
                                        return <Mermaid chart={codeText} className="my-8" />;
                                      }

                                      return (
                                        <CodeBlock 
                                          code={codeText} 
                                          language={language as any}
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
                                    }
                                  }}
                                >
                                  {sub.content}
                                </Streamdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </article>
              ))}
            </motion.div>
          </section>

          {/* III. Right Column: Chat (4/12) */}
          <AnimatePresence>
            {showChat && (
              <aside className="col-span-12 lg:col-span-4 h-[calc(100vh-120px)] sticky top-24">
                <motion.div 
                  key="chat"
                  initial={{ opacity: 0, x: 50, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 50, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="h-full bg-secondary/10 rounded-[2.5rem] border border-border/30 overflow-hidden flex flex-col relative shadow-2xl shadow-primary/5"
                >

                  {/* Header Actions */}
                  <div className="absolute top-6 left-6 z-10">
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
                  <Conversation className="flex-1">
                    <ConversationContent className="pb-32 pt-12 px-6">
                      {messages.length === 0 ? (
                        <ConversationEmptyState 
                          icon={<Sparkles className="w-10 h-10 text-primary/40 mb-2" />}
                          title="Ask anything about this codebase"
                          description="I can help you understand the architecture, find specific logic, or explain dependencies."
                        />
                      ) : (
                        messages.map((m) => (
                          <AIMessage key={m.id} from={m.role}>
                            <MessageContent className={cn(
                              m.role === 'user' ? "rounded-3xl bg-primary text-primary-foreground p-5" : "rounded-none bg-transparent border-none p-0"
                            )}>
                              {m.role === 'assistant' ? (
<div className="space-y-4">
  <MessageResponse components={chatStreamdownComponents}>
    {m.content}
  </MessageResponse>
  <ToolCallStatus toolInvocations={m.toolInvocations} />
</div>
                              ) : (
                                <>
                                  <p className="text-sm leading-relaxed">{m.content}</p>
                                </>
                              )}
                            </MessageContent>
                            {m.role === 'user' && <CopyButton content={m.content} isUser={true} />}
                            {m.role === 'assistant' && <CopyButton content={m.content} isUser={false} />}
                          </AIMessage>
                        ))
                      )}
                    </ConversationContent>
                    <ConversationScrollButton />
                  </Conversation>

                  <div className="p-8 pt-4 space-y-6 border-t border-border/5 relative z-20">
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
                        await handleChatSubmit(e as any);
                      }}
                      className="relative"
                    >
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const form = e.currentTarget.form;
                            if (form) form.requestSubmit();
                          }
                        }}
                        placeholder="Ask about this repository..."
                        className="min-h-[100px] max-h-48 bg-transparent border-border/10 focus-visible:ring-primary/20 rounded-2xl pr-14 py-4 resize-none"
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
                            : "bg-primary text-primary-foreground hover:opacity-90 shadow-primary/20"
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
