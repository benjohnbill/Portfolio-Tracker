import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Search, Bell, Sparkles, User } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#07090d]">
            {/* Top Bar */}
            <header className="h-20 border-b border-border/40 flex items-center justify-between px-8 bg-background/20 backdrop-blur-sm sticky top-0 z-10">
              <div className="relative w-full max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search assets, trends, insights..."
                  className="w-full bg-[#11161d] border border-border/60 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#11161d] rounded-md cursor-pointer hover:bg-accent/30 transition-colors">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="p-2 bg-[#11161d] rounded-md cursor-pointer hover:bg-accent/30 transition-colors">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center space-x-3 p-1.5 px-3 bg-[#11161d] rounded-lg border border-border/40 cursor-pointer">
                   <User className="w-4 h-4 text-primary" />
                   <span className="text-sm font-medium">Jingeun</span>
                </div>
              </div>
            </header>

            {/* Content Wrapper */}
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
