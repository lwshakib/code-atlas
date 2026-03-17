"use client";

import React from 'react';
import { 
  Github, 
  LogOut, 
  User, 
  Settings, 
  LayoutDashboard 
} from 'lucide-react';
import { LogoWithText } from '@/components/Logo';
import { Button } from '@/components/ui/button';
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

export default function CodebasePage() {
  const [scrolled, setScrolled] = React.useState(false);
  const { data: session } = authClient.useSession();
  const router = useRouter();

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
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

          {/* Right: Auth Action */}
          <div className="flex items-center justify-end w-1/3">
            {!session ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2 border-border bg-transparent hover:bg-secondary/50"
                onClick={handleSignIn}
              >
                <Github className="w-5 h-5" />
                <span className="text-xs font-medium">Login with GitHub</span>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="size-10 p-0 rounded-full overflow-hidden border border-border/50 hover:bg-secondary/50">
                    <Avatar size="default">
                      <AvatarImage src={session.user.image || ""} alt={session.user.name || "User"} />
                      <AvatarFallback className="text-xs">{session.user.name?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/codebase')} className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" 
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen pt-16">
        <h1 className="text-4xl font-bold font-oswald uppercase tracking-tighter">codebase</h1>
      </div>
    </div>
  );
}
