import { HomeIcon, DiscoverIcon, DownloadsIcon, HistoryIcon, SettingsIcon } from './CustomIcons';
import { clsx } from 'clsx';
import { motion } from 'motion/react';

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
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-black/60 backdrop-blur-2xl px-4 py-2 z-40 border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <div className="flex justify-between items-center h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={clsx(
                'flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-300 relative',
                isActive ? 'text-accent-lime scale-110' : 'text-text-muted hover:text-text-main'
              )}
            >
              <Icon 
                size={22} 
              />
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute -bottom-1 w-1 h-1 bg-accent-lime rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
