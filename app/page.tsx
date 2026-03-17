"use client";

import React from 'react';
import { 
  Github, 
  Link as LinkIcon, 
  CodeXml, 
  ArrowRight, 
  MessageCircle, 
  ZoomIn, 
  LayoutDashboard, 
  Zap, 
  RefreshCcw, 
  MessagesSquare, 
  Search, 
  Gauge, 
  Sparkles, 
  ArrowUpRight,
  Star
} from 'lucide-react';
import BackgroundCanvas from '@/components/background-canvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogoWithText } from '@/components/Logo';

const ScrollingCode = ({ color = "text-blue-400/20" }) => {
  const codeSnippet = `
export default function CodeAtlas({ repo }) {
  const [data, setData] = useState(null);
  const { analyze, status } = useAgent();
  
  useEffect(() => {
    async function init() {
      const result = await analyze(repo);
      setData(result);
    }
    init();
  }, [repo, analyze]);

  return (
    <div className="atlas-view flex flex-col gap-4 p-4">
      <Header title={repo.name} status={status} />
      <div className="grid grid-cols-12 gap-6 h-full">
        <Sidebar className="col-span-3 border-r border-border/50" />
        <main className="col-span-9 relative overflow-hidden rounded-2xl">
          {data?.modules.map(module => (
            <ModuleNode key={module.id} {...module} onSelect={() => navigate(module.path)} />
          ))}
          <OverlayLayer active={status === 'analyzing'} />
        </main>
      </div>
      <ChatPanel floating className="bottom-8 right-8 z-50 w-96 max-h-[600px]" />
    </div>
  );
}

class ArchitectureMapper {
  constructor(root, options = {}) {
    this.root = root;
    this.options = { depth: 3, includeVendor: false, ...options };
    this.nodes = new Map();
    this.edges = new Set();
  }

  async buildGraph() {
    const files = await fs.readDirRecursive(this.root, this.options.exclude);
    const parsePromises = files.map(async file => {
      const content = await fs.readFile(file, 'utf8');
      return { file, ast: await parser.parse(content, { sourceType: 'module' }) };
    });

    const parsedFiles = await Promise.all(parsePromises);
    for (const { file, ast } of parsedFiles) {
      this.extractNodesAndEdges(file, ast);
    }
    
    return this.serialize();
  }

  extractNodesAndEdges(file, ast) {
    // Advanced LLM Context Injection for Semantic Mapping
    const context = llm.generateSemanticContext(ast, { 
      includeDocstrings: true,
      analyzeComplexity: true,
      detectPatterns: ['singleton', 'factory', 'observer']
    });
    this.nodes.set(file, { path: file, metadata: context, type: 'module' });
  }
}
  `.repeat(6);

  return (
    <div className={`h-full w-full overflow-hidden relative font-mono text-sm sm:text-base leading-relaxed ${color} select-none`}>
      <div className="animate-scroll-vertical whitespace-pre-wrap">
        {codeSnippet}
      </div>
    </div>
  );
};

const ScrollingChat = () => {
  const messages = Array.from({ length: 12 }).map((_, i) => ({
    side: i % 2 === 0 ? 'left' : 'right',
    width: ['w-2/3', 'w-1/2', 'w-3/4'][i % 3],
  }));

  const messageItems = [...messages, ...messages].map((m, i) => (
    <div key={i} className={`flex w-full mb-6 ${m.side === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div className={`h-16 rounded-2xl border border-border/50 ${m.width} bg-secondary/20 p-4 flex flex-col gap-2`}>
        <div className="h-2 w-1/4 bg-primary/20 rounded-full" />
        <div className="h-2 w-full bg-muted/20 rounded-full" />
        <div className="h-2 w-2/3 bg-muted/20 rounded-full" />
      </div>
    </div>
  ));

  return (
    <div className="h-full w-full overflow-hidden relative select-none p-12">
      <div className="animate-scroll-vertical flex flex-col">
        {messageItems}
      </div>
    </div>
  );
};

export default function LandingPage() {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="antialiased selection:bg-primary selection:text-primary-foreground text-foreground bg-background min-h-screen font-sans">
      <BackgroundCanvas />

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

          {/* Right: Login */}
          <div className="flex items-center justify-end w-1/3">
            <Button variant="outline" size="sm" className="flex items-center gap-2 border-border bg-transparent hover:bg-secondary/50">
              <Github className="w-5 h-5" />
              <span className="text-xs font-medium">Login with GitHub</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative w-full h-screen flex flex-col justify-end pb-12 sm:pb-24 px-6 overflow-hidden">
        {/* Background AI Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero-atlas-new.jpg" 
            alt="Codebase Atlas Visualization" 
            className="w-full h-full object-cover object-center opacity-60" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
        </div>

        <div className="z-10 w-full max-w-screen-2xl mx-auto relative">
          <Badge variant="secondary" className="mb-6 px-3 py-1 text-xs font-medium">
            Agentic AI Powered Exploration
          </Badge>
          <h1 className="md:text-7xl lg:text-8xl leading-[0.9] text-5xl text-foreground tracking-tighter max-w-4xl font-oswald font-normal uppercase">
            EXPLORE YOUR <br /> <span className="text-muted-foreground">CODEBASE.</span>
          </h1>
          
          <div className="flex flex-col lg:flex-row items-end justify-between mt-12 gap-12 pt-8">
            <div className="w-full max-w-2xl">
              <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-lg">
                Visualize architecture, chat with your logic, and navigate complex repositories with precision. 
                The ultimate atlas for modern software engineering.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="rounded-lg px-8">
                  Get Started
                </Button>
              </div>
            </div>

            {/* GitHub URL Input on the Right */}
            <div className="w-full lg:max-w-md shrink-0">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input 
                  type="text" 
                  placeholder="Paste GitHub repository URL..." 
                  className="w-full bg-secondary/30 border-border rounded-lg py-6 pl-10 pr-32 text-sm focus-visible:ring-primary/20"
                />
                <Button className="absolute right-1.5 top-1.5 h-[calc(100%-12px)] px-6" size="sm">
                  Explore
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 ml-1">Example: https://github.com/facebook/react</p>
            </div>
          </div>
        </div>
      </header>

      {/* Featured Categories */}
      <section className="border-b border-border bg-secondary/5">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Category 1 */}
          <div className="group relative h-96 overflow-hidden cursor-pointer hover:bg-primary/[0.02] transition-colors">
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4 group-hover:scale-110 transition-transform">
                <CodeXml className="w-12 h-12 text-primary opacity-80" />
              </div>
              <h3 className="text-2xl tracking-tight font-oswald uppercase text-foreground">Architecture</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">Visualize module dependencies and system flow.</p>
            </div>
            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0 text-primary">
              <ArrowRight className="w-6 h-6" />
            </div>
          </div>
          
          {/* Category 2 */}
          <div className="group relative h-96 overflow-hidden cursor-pointer hover:bg-primary/[0.02] transition-colors">
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-12 h-12 text-primary opacity-80" />
              </div>
              <h3 className="text-2xl tracking-tight font-oswald uppercase text-foreground">AI Context</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">Ask questions and get answers with deep code awareness.</p>
            </div>
            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0 text-primary">
              <ArrowRight className="w-6 h-6" />
            </div>
          </div>

          {/* Category 3 */}
          <div className="group relative h-96 overflow-hidden cursor-pointer hover:bg-primary/[0.02] transition-colors">
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4 group-hover:scale-110 transition-transform">
                <ZoomIn className="w-12 h-12 text-primary opacity-80" />
              </div>
              <h3 className="text-2xl tracking-tight font-oswald uppercase text-foreground">Exploration</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">Semantic search and advanced navigation tools.</p>
            </div>
            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0 text-primary">
              <ArrowRight className="w-6 h-6" />
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Features Section 1: Read your app */}
      <section className="py-32 px-6 max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-8">
              Read your app <br /> for the first time
            </h2>
            <p className="text-muted-foreground text-lg mb-12 max-w-lg">
              Code documentation that works for you, not the other way around. 
              Our AI agent automatically generates and maintains a rich, interactive knowledge base from your code.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-16">
              <div>
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-6">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-bold text-lg mb-3">Understand your code section by section</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Focus on the code you care about. Pick a section and dive deeper to see exactly how it works.
                </p>
              </div>

              <div>
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-bold text-lg mb-3">Generated automatically</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Our AI agent automatically generates and maintains a rich, interactive knowledge base from your code.
                </p>
              </div>

              <div>
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-6">
                  <RefreshCcw className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-bold text-lg mb-3">Always up-to-date</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every time a pull request is merged, the relevant documentation is automatically updated.
                </p>
              </div>

              <div>
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-6">
                  <LinkIcon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-bold text-lg mb-3">Linked back to your code</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Instantly jump from an architectural overview to the exact service, or from a function's description to its definition.
                </p>
              </div>
            </div>
          </div>

          <div className="relative aspect-square flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-blue-500/5 rounded-full blur-[120px] scale-110"></div>
            <div className="relative w-full h-full [mask-image:radial-gradient(circle_at_center,white_30%,transparent_70%)]">
              <ScrollingCode color="text-blue-400/50" />
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Features Section 2: Talk to your codebase */}
      <section className="py-32 px-6 max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div className="order-2 lg:order-1 relative aspect-square flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-purple-500/5 rounded-full blur-[120px] scale-110"></div>
            <div className="relative w-full h-full [mask-image:radial-gradient(circle_at_center,white_30%,transparent_70%)]">
              <ScrollingChat />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-8">
              Talk to your codebase
            </h2>
            <p className="text-muted-foreground text-lg mb-12 max-w-lg">
              Ask questions about your architecture, find function definitions, and understand complex logic in natural language. 
              It's like having an engineer on call, 24/7.
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-xl border border-border/50 group hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                  <MessagesSquare className="w-6 h-6 text-primary" />
                </div>
                <span className="font-medium">Chat with your codebase</span>
              </div>

              <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-xl border border-border/50 group hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <span className="font-medium">Find what you need instantly</span>
              </div>

              <div className="flex items-center gap-4 bg-secondary/30 p-4 rounded-xl border border-border/50 group hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-primary" />
                </div>
                <span className="font-medium">Low latency, high-quality responses</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trial Section */}
      <section className="py-32 px-6 max-w-screen-2xl mx-auto">
        <div className="bg-secondary/20 rounded-3xl p-12 lg:p-24 border border-border relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
             <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full transform translate-x-1/2 -translate-y-1/2"></div>
             <div className="absolute inset-0 bg-purple-500/10 blur-[120px] rounded-full transform translate-x-1/3 translate-y-1/3"></div>
          </div>
          
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-8">Try it with your own private repository</h2>
            
            <p className="text-muted-foreground text-lg mb-12">
              Stop documenting. Start understanding. Connect your repository and get a fully interactive Code Wiki 
              that stays perfectly in sync with every change. No more stale docs. Ever.
            </p>

            <Button size="lg" className="h-16 px-8 rounded-2xl bg-white text-black hover:bg-white/90 group">
              <Sparkles className="w-6 h-6 mr-3 text-blue-600" />
              Get Started
              <ArrowUpRight className="w-5 h-5 ml-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Button>
          </div>
        </div>
      </section>

      {/* Interactive Banner */}
      <section className="py-12 border-y border-border overflow-hidden bg-foreground text-background">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="text-4xl md:text-6xl tracking-tighter mx-8 font-oswald uppercase">SEMANTIC SEARCH</span>
          <Star className="w-12 h-12 text-background" />
          <span className="text-4xl md:text-6xl tracking-tighter mx-8 font-oswald uppercase">ARCHITECTURE ANALYSIS</span>
          <Star className="w-12 h-12 text-background" />
          <span className="text-4xl md:text-6xl tracking-tighter mx-8 font-oswald uppercase">AI CODE ASSISTANCE</span>
          <Star className="w-12 h-12 text-background" />
          <span className="text-4xl md:text-6xl tracking-tighter mx-8 font-oswald uppercase">CODE ATLAS</span>
          <Star className="w-12 h-12 text-background" />
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-24 pb-12 px-6 max-w-screen-2xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
          <div className="max-w-md">
            <h4 className="text-lg font-medium mb-4 text-foreground">Join the list</h4>
            <p className="text-muted-foreground text-sm mb-6">Receive early access to new drops and exclusive editorial content.</p>
            <form className="flex w-full max-w-sm border-b border-border pb-2 focus-within:border-primary transition-colors">
              <input type="email" placeholder="Email address" className="bg-transparent w-full outline-none text-sm placeholder-muted-foreground text-foreground" />
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </form>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 lg:gap-24 text-sm">
            <div className="flex flex-col gap-3">
              <span className="text-muted-foreground mb-1">Explore</span>
              <a href="#" className="hover:text-primary transition-colors text-foreground">Documentation</a>
              <a href="#" className="hover:text-primary transition-colors text-foreground">API Reference</a>
              <a href="#" className="hover:text-primary transition-colors text-foreground">Community</a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-muted-foreground mb-1">Company</span>
              <a href="#" className="hover:text-primary transition-colors text-foreground">About</a>
              <a href="#" className="hover:text-primary transition-colors text-foreground">Blog</a>
              <a href="#" className="hover:text-primary transition-colors text-foreground">Careers</a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-muted-foreground mb-1">Social</span>
              <a href="#" className="hover:text-primary transition-colors text-foreground">GitHub</a>
              <a href="#" className="hover:text-primary transition-colors text-foreground">Discord</a>
              <a href="#" className="hover:text-primary transition-colors text-foreground">X (Twitter)</a>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-24 pt-8 border-t border-border text-xs text-muted-foreground">
          <span>© 2024 Code Atlas Studios.</span>
          <div className="flex gap-4">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
