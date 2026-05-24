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
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-surface/90 backdrop-blur-3xl z-40 border-t border-white/10 shadow-[0_-5px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-md mx-auto flex justify-between items-center h-16 px-6 pb-[env(safe-area-inset-bottom,2px)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={clsx(
                'flex flex-col items-center justify-center flex-1 py-1 transition-all relative',
                isActive ? 'text-accent-main scale-105 font-bold' : 'text-text-muted hover:text-text-main hover:scale-105'
              )}
            >
              <Icon 
                size={22} 
              />
              <span className="text-[9px] mt-1 font-medium tracking-wide uppercase select-none">
                {tab.label}
              </span>
              {isActive && (
                <motion.div 
                   layoutId="activeTab"
                  className="absolute bottom-0 w-8 h-[2px] bg-accent-main rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
