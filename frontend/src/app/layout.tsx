import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Bell, Sparkles, User } from 'lucide-react';

export const metadata: Metadata = {
  title: 'OrbitAI | Portfolio Tracker',
  description: 'AI-assisted Portfolio Tracker Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
            <header className="h-20 border-b border-border/60 flex items-center justify-between px-8 bg-card sticky top-0 z-10">
              <div className="w-full max-w-xl text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Portfolio intelligence workspace
              </div>
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-accent rounded-md transition-colors" aria-hidden="true">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="p-2 bg-accent rounded-md transition-colors" aria-hidden="true">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center space-x-3 p-1.5 px-3 bg-accent rounded-lg border border-border/60">
                   <User className="w-4 h-4 text-primary" />
                   <span className="text-sm font-medium">Jingeun</span>
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
              <div className="max-w-[1400px] mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
