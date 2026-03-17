"use client";

import React from 'react';
import { 
  Github, 
  LogOut, 
  User, 
  Settings, 
  LayoutDashboard,
  Plus 
} from 'lucide-react';
import { LogoWithText, Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { 
  Avatar, 
  AvatarImage, 
  AvatarFallback 
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Link as LinkIcon, 
  Download, 
  ArrowRight,
  Loader2,
  BookOpen,
  AlertCircle,
  History,
  RefreshCw,
  Lock,
  Search
} from 'lucide-react';
import { fetchGithubRepositoriesAction } from "@/actions/github";
import { GithubRepo } from "@/actions/github";
import { formatDistanceToNow } from 'date-fns';

export default function CodebasePage() {
  const [scrolled, setScrolled] = React.useState(false);
  const [isNewCodebaseOpen, setIsNewCodebaseOpen] = React.useState(false);
  const [dialogView, setDialogView] = React.useState<'selection' | 'url' | 'import'>('selection');
  const [repoUrl, setRepoUrl] = React.useState("");
  const [repositories, setRepositories] = React.useState<GithubRepo[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoadingRepos, setIsLoadingRepos] = React.useState(false);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [repoError, setRepoError] = React.useState<string | null>(null);
  
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  const { data: session } = authClient.useSession();
  const router = useRouter();

  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    setRepoError(null);
    setPage(1);
    setHasMore(true);
    const result = await fetchGithubRepositoriesAction(1);
    if (result.success && result.data) {
      setRepositories(result.data);
      if (result.data.length < 20) setHasMore(false);
    } else {
      setRepoError(result.error || "Failed to load repositories");
    }
    setIsLoadingRepos(false);
  };

  const loadMore = async () => {
    if (isFetchingMore || !hasMore || searchQuery) return;
    
    setIsFetchingMore(true);
    const nextPage = page + 1;
    const result = await fetchGithubRepositoriesAction(nextPage);
    
    if (result.success && result.data) {
      if (result.data.length === 0) {
        setHasMore(false);
      } else {
        setRepositories(prev => [...prev, ...result.data!]);
        setPage(nextPage);
        if (result.data.length < 20) setHasMore(false);
      }
    }
    setIsFetchingMore(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      loadMore();
    }
  };

  React.useEffect(() => {
    if (dialogView === 'import' && session && repositories.length === 0) {
      fetchRepos();
    }
  }, [dialogView, session]);

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: 'github',
      callbackURL: '/codebase',
    });
  };

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.refresh();
        },
      },
    });
  };

  React.useEffect(() => {
    const handleWindowScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleWindowScroll);
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsNewCodebaseOpen(open);
    if (!open) {
      // Reset view when closing
      setTimeout(() => setDialogView('selection'), 300);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-background/80 backdrop-blur-md border-b border-border py-0' : 'bg-transparent py-2'
      }`}>
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center w-1/3">
            <a href="/">
              <LogoWithText size={28} />
            </a>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end w-1/3 gap-3">
            <Button 
              variant="default" 
              size="sm" 
              className="hidden sm:flex items-center h-9 px-6 rounded-full bg-white text-black hover:bg-white/90 border-none transition-all shadow-lg shadow-white/5 active:scale-95"
              onClick={() => !session ? handleSignIn() : setIsNewCodebaseOpen(true)}
            >
              <span className="text-xs font-semibold">New Codebase</span>
            </Button>

            {!session ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2 h-9 rounded-full px-5 border-border/50 bg-transparent hover:bg-secondary/50"
                onClick={handleSignIn}
              >
                <Github className="w-4 h-4" />
                <span className="text-xs font-medium">Login</span>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="size-9 p-0 rounded-full overflow-hidden border border-border/50 hover:bg-secondary/50 transition-all hover:scale-105 active:scale-95">
                    <Avatar className="h-full w-full">
                      <AvatarImage src={session.user.image || ""} alt={session.user.name || "User"} />
                      <AvatarFallback className="text-xs bg-primary/10">{session.user.name?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2 p-1.5 border-border/50 backdrop-blur-xl bg-background/95 shadow-2xl shadow-primary/5">
                  <DropdownMenuLabel className="font-normal px-2 py-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{session.user.name}</p>
                      <p className="text-[10px] leading-none text-muted-foreground">{session.user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={() => router.push('/codebase')} className="cursor-pointer rounded-md focus:bg-secondary/80 py-2">
                    <LayoutDashboard className="mr-2 h-4 w-4 opacity-70" />
                    <span className="text-sm font-medium">Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer rounded-md focus:bg-secondary/80 py-2">
                    <User className="mr-2 h-4 w-4 opacity-70" />
                    <span className="text-sm font-medium">Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer rounded-md focus:bg-secondary/80 py-2">
                    <Settings className="mr-2 h-4 w-4 opacity-70" />
                    <span className="text-sm font-medium">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem 
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-md py-2" 
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4 opacity-70" />
                    <span className="text-sm font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      {/* New Codebase Dialog */}
      <Dialog open={isNewCodebaseOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-3xl rounded-3xl shadow-2xl transition-all duration-300">
          <div className="p-8 min-h-[400px] flex flex-col">
            <header className="mb-8 flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {dialogView === 'selection' ? 'Add new codebase' : 
                   dialogView === 'url' ? 'GitHub Public URL' : 'Import Repositories'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {dialogView === 'selection' ? 'Connect your repository to begin.' : 
                   dialogView === 'url' ? 'Paste a link to any public repository.' : 
                   'Select an existing GitHub project.'}
                </DialogDescription>
              </div>
              {dialogView !== 'selection' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full px-3 h-8 bg-secondary/30 hover:bg-secondary/50 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all"
                  onClick={() => setDialogView('selection')}
                >
                  Back
                </Button>
              )}
            </header>
            
            <div className="flex-1">
              {dialogView === 'selection' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <button 
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 hover:border-primary/20 transition-all group text-center h-full"
                    onClick={() => setDialogView('url')}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform duration-300">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm block mb-1 tracking-tight">Public URL</span>
                    <span className="text-[10px] text-muted-foreground leading-tight px-2">Analyze any public repo instantly.</span>
                  </button>

                  <button 
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 hover:border-primary/20 transition-all group text-center h-full"
                    onClick={() => setDialogView('import')}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform duration-300">
                      <Download className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm block mb-1 tracking-tight">Import Repo</span>
                    <span className="text-[10px] text-muted-foreground leading-tight px-2">Connect and sync your own projects.</span>
                  </button>
                </div>
              )}

              {dialogView === 'url' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="url" className="text-[10px] font-bold text-muted-foreground ml-1">Repository endpoint</Label>
                    <div className="relative group">
                      <Input 
                        id="url"
                        placeholder="https://github.com/username/repository" 
                        className="bg-secondary/20 h-14 border-border/50 focus-visible:ring-primary/20 rounded-xl pl-5 pr-14 transition-all text-sm"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        autoFocus
                      />
                      <div className="absolute right-2 top-2">
                        <Button size="icon" className="h-10 w-10 rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all bg-primary text-primary-foreground">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] text-muted-foreground leading-normal italic">
                      Public repositories are processed and cached for fast access.
                    </p>
                  </div>
                </div>
              )}

              {dialogView === 'import' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3 px-1 gap-3">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                      <Input 
                        placeholder="Search repos..." 
                        className="bg-secondary/15 h-8 border-border/40 focus-visible:ring-primary/10 rounded-lg pl-8 pr-2 text-[10px] transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      onClick={fetchRepos}
                      disabled={isLoadingRepos}
                      title="Refresh repositories"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRepos ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>

                  <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 custom-scrollbar min-h-[220px] max-h-[300px]"
                  >
                    {isLoadingRepos && repositories.length === 0 ? (
                      <div className="space-y-1.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/20 bg-secondary/5 opacity-60">
                            <div className="h-8 w-8 rounded-lg bg-background border border-border/50 items-center justify-center flex shrink-0 shadow-sm overflow-hidden">
                              <Skeleton className="h-full w-full opacity-30" />
                            </div>
                            <div className="flex-1 space-y-1.5 overflow-hidden">
                              <Skeleton className="h-4 w-[60%] rounded-md" />
                              <div className="flex gap-2">
                                <Skeleton className="h-3 w-12 rounded-sm" />
                                <Skeleton className="h-3 w-16 rounded-sm" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : repoError ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-destructive/5 rounded-2xl border border-destructive/10">
                        <AlertCircle className="w-6 h-6 text-destructive/40 mb-3" />
                        <p className="text-[10px] font-semibold text-destructive/80 mb-3">{repoError}</p>
                        <Button variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-bold" onClick={fetchRepos}>
                          Try Again
                        </Button>
                      </div>
                    ) : repositories.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-3 opacity-50">
                        <Github className="w-8 h-8 text-muted-foreground/30" />
                        <p className="text-[10px] text-muted-foreground">{searchQuery ? 'No matching repos found.' : 'No repositories found.'}</p>
                      </div>
                    ) : (
                      <>
                        {repositories
                          .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((repo) => (
                          <div 
                            key={repo.id} 
                            className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-secondary/5 hover:bg-secondary/15 hover:border-primary/10 cursor-pointer transition-all group"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="hidden sm:flex flex-shrink-0 w-8 h-8 rounded-lg bg-background border border-border/50 items-center justify-center shadow-sm group-hover:bg-primary/5 transition-colors">
                                <Github className="w-4 h-4 text-primary/70" />
                              </div>
                              <div className="overflow-hidden">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold truncate tracking-tight">{repo.name}</p>
                                  {repo.private && (
                                    <Lock className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {repo.language && (
                                    <span className="text-[9px] text-muted-foreground font-medium">{repo.language}</span>
                                  )}
                                  <span className="text-[9px] text-muted-foreground/60">
                                    {repo.updated_at ? formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true }) : 'Recently'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all flex-shrink-0" />
                          </div>
                        ))}
                        {isFetchingMore && (
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/20 bg-secondary/5 opacity-60">
                            <div className="h-8 w-8 rounded-lg bg-background border border-border/50 items-center justify-center flex shrink-0 shadow-sm overflow-hidden">
                              <Skeleton className="h-full w-full opacity-30" />
                            </div>
                            <div className="flex-1 space-y-1.5 overflow-hidden">
                              <Skeleton className="h-4 w-[40%] rounded-md" />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
