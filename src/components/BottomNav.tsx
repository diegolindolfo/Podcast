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
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-main/90 backdrop-blur-lg pb-safe z-40 border-t border-border-subtle">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={clsx(
                'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors',
                isActive ? 'text-accent-main' : 'text-text-muted hover:text-text-main'
              )}
            >
              <Icon 
                size={20} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
