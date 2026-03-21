import Link from 'next/link';
import { 
  LayoutDashboard, 
  Calendar, 
  BrainCircuit, 
  Focus, 
  BarChart3, 
  FlaskConical, 
  PenTool, 
  FileText, 
  Settings,
  LogOut
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/', active: true },
  { icon: Calendar, label: 'Portfolio', href: '#' },
  { icon: BrainCircuit, label: 'AI Intelligence', href: '#' },
  { icon: Focus, label: 'Analysis Mode', href: '#' },
  { icon: BarChart3, label: 'Insights', href: '#' },
];

const labItems = [
  { label: 'Chat Space', href: '#' },
  { label: 'Prediction', href: '#' },
  { label: 'Automation', href: '#' },
];

export function Sidebar() {
  return (
    <div className="w-64 h-screen sidebar-gradient border-r border-border/50 flex flex-col p-6 space-y-8 sticky top-0 overflow-y-auto">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">Orbit<span className="text-primary">AI</span></span>
      </div>

      <nav className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Main Menu</p>
        {navItems.map((item) => (
          <Link 
            key={item.label} 
            href={item.href}
            className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
              item.active 
                ? 'neon-border-active text-white' 
                : 'text-muted-foreground hover:text-white hover:bg-accent/50'
            }`}
          >
            <item.icon className={`w-5 h-5 ${item.active ? 'text-primary' : ''}`} />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">AI Lab</p>
        <div className="space-y-1 px-2">
          {labItems.map((item) => (
            <Link 
              key={item.label} 
              href={item.href}
              className="flex items-center space-x-3 py-2 text-sm text-muted-foreground hover:text-white transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full border border-muted-foreground" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-4 pt-8">
        <Link href="#" className="flex items-center space-x-3 px-3 py-2 text-muted-foreground hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
          <span className="text-sm font-medium">Settings</span>
        </Link>
        <div className="flex items-center justify-between px-3 py-4 border-t border-border/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-accent" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white">Jingeun</span>
              <span className="text-[10px] text-muted-foreground">Free plan</span>
            </div>
          </div>
          <LogOut className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-destructive" />
        </div>
      </div>
    </div>
  );
}
