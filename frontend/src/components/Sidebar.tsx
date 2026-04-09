"use client";

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Archive,
  Brain,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'This Week', href: '/' },
  { icon: CalendarDays, label: 'Friday', href: '/friday' },
  { icon: Wallet, label: 'Portfolio', href: '/portfolio' },
  { icon: Brain, label: 'Intelligence', href: '/intelligence' },
  { icon: Archive, label: 'Archive', href: '/archive' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className={`h-screen sidebar-gradient border-r border-border/50 flex flex-col sticky top-0 overflow-x-hidden overflow-y-auto transition-[width,padding] duration-300 ease-in-out ${collapsed ? 'w-20 p-4' : 'w-64 p-6'} space-y-8`}
    >
      <div className={`flex items-center mb-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'}`}>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <div className="w-4 h-4 rounded-full border-2 border-primary-foreground" />
        </div>
        <span className={`text-xl font-bold tracking-tight text-white whitespace-nowrap transition-all duration-200 ${collapsed ? 'w-0 opacity-0 -translate-x-2 pointer-events-none' : 'w-auto opacity-100 translate-x-0 ml-3'}`}>
          Orbit<span className="text-primary">AI</span>
        </span>
        </div>
        <button
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className={`shrink-0 rounded-md border border-border/50 bg-card/80 p-2 text-muted-foreground transition-all hover:text-white hover:border-primary/40 hover:bg-accent/40 ${collapsed ? 'absolute top-4 right-4' : ''}`}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      <nav className="space-y-1">
        <p className={`text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 transition-all duration-200 ${collapsed ? 'opacity-0 h-0 mb-0 overflow-hidden px-0' : 'opacity-100 px-2'}`}>
          Main Menu
        </p>
        {navItems.map((item) => (
          <Link 
            key={item.label} 
            href={item.href}
            className={`flex items-center px-3 py-2 rounded-md transition-all duration-200 ${collapsed ? 'justify-center' : 'space-x-3'} ${
              isActive(item.href)
                ? 'nav-active text-white' 
                : 'text-muted-foreground hover:text-white hover:bg-accent/50'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className={`w-5 h-5 shrink-0 ${isActive(item.href) ? 'text-primary' : ''}`} />
            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-200 ${collapsed ? 'w-0 opacity-0 -translate-x-2 pointer-events-none' : 'w-auto opacity-100 translate-x-0'}`}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
