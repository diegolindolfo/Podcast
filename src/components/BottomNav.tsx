import { HomeIcon, DiscoverIcon, DownloadsIcon, HistoryIcon, SettingsIcon } from './CustomIcons';
import { clsx } from 'clsx';

interface BottomNavProps {
  currentTab: string;
  onChange: (tab: string) => void;
}

export function BottomNav({ currentTab, onChange }: BottomNavProps) {
  const tabs = [
    { id: 'home', icon: HomeIcon, label: 'Início' },
    { id: 'search', icon: DiscoverIcon, label: 'Descobrir' },
    { id: 'downloads', icon: DownloadsIcon, label: 'Downloads' },
    { id: 'history', icon: HistoryIcon, label: 'Histórico' },
    { id: 'settings', icon: SettingsIcon, label: 'Ajustes' },
  ];

  return (
    <nav aria-label="Navegação principal" className="fixed bottom-0 left-0 right-0 bg-bg-main/90 backdrop-blur-lg pb-safe z-40 border-t border-border-subtle">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className={clsx(
                'relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all rounded-xl mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-main/60',
                isActive ? 'text-accent-main bg-accent-main/10' : 'text-text-muted hover:text-text-main hover:bg-bg-surface/50'
              )}
            >
              {isActive && <span className="absolute top-1 w-8 h-0.5 rounded-full bg-accent-main" />}
              <Icon 
                size={24} 
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
