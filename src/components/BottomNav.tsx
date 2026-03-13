import { Home, Search, Download, Settings, History } from 'lucide-react';
import { clsx } from 'clsx';

interface BottomNavProps {
  currentTab: string;
  onChange: (tab: string) => void;
}

export function BottomNav({ currentTab, onChange }: BottomNavProps) {
  const tabs = [
    { id: 'home', icon: Home, label: 'Início' },
    { id: 'search', icon: Search, label: 'Descobrir' },
    { id: 'downloads', icon: Download, label: 'Downloads' },
    { id: 'history', icon: History, label: 'Histórico' },
    { id: 'settings', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass pb-safe z-40 border-t border-white/5">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={clsx(
                'flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-500 relative group',
                isActive ? 'text-accent' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <div className={clsx(
                "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-500",
                isActive && "opacity-100"
              )}>
                <div className="w-12 h-12 bg-accent/20 rounded-full blur-xl" />
              </div>
              <Icon 
                size={20} 
                strokeWidth={isActive ? 3 : 2} 
                className={clsx(
                  "relative z-10 transition-transform duration-500",
                  isActive ? "scale-110" : "group-hover:scale-110"
                )} 
              />
              <span className="text-[9px] font-black tracking-[0.2em] relative z-10 uppercase">{tab.label}</span>
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgba(var(--app-accent-rgb),0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
