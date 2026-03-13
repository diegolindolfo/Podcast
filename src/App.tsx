import { useState, useEffect } from 'react';
import { Home } from './components/Home';
import { Search } from './components/Search';
import { Downloads } from './components/Downloads';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { BottomNav } from './components/BottomNav';
import { Player } from './components/Player';
import { PodcastDetail } from './components/PodcastDetail';
import { useStore } from './store';
import { Podcast } from './types';
import { deleteDownloadedEpisode } from './services/downloader';

import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const { 
    loadSubscriptions, 
    loadDownloads, 
    loadSavedProgress, 
    loadListenedPodcasts, 
    loadPodcastTimestamps, 
    loadCurrentEpisode, 
    loadHistory, 
    loadSettings,
    loadFinishedAt,
    accentColor,
    settings,
    finishedAt,
    downloads
  } = useStore();

  useEffect(() => {
    loadSubscriptions();
    loadDownloads();
    loadSavedProgress();
    loadListenedPodcasts();
    loadPodcastTimestamps();
    loadCurrentEpisode();
    loadHistory();
    loadSettings();
    loadFinishedAt();
  }, []);

  // Auto-delete logic
  useEffect(() => {
    if (!settings.autoDelete) return;

    const checkAndCleanup = async () => {
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000;

      for (const episodeId in finishedAt) {
        const finishedTimestamp = finishedAt[episodeId];
        if (now - finishedTimestamp > oneDayInMs) {
          const download = downloads.find(d => d.id === episodeId);
          if (download) {
            console.log(`Auto-deleting finished episode: ${download.title}`);
            await deleteDownloadedEpisode(download.id, download.audioUrl);
          }
        }
      }
    };

    // Check every hour
    const interval = setInterval(checkAndCleanup, 60 * 60 * 1000);
    checkAndCleanup(); // Run once on start

    return () => clearInterval(interval);
  }, [settings.autoDelete, finishedAt, downloads]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-accent', accentColor);
  }, [accentColor]);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    setSelectedPodcast(null);
  };

  const handleSelectPodcast = (podcast: Podcast) => {
    setSelectedPodcast(podcast);
  };

  const handleBack = () => {
    setSelectedPodcast(null);
  };

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <AnimatePresence mode="wait">
        {selectedPodcast ? (
          <motion.div
            key="podcast-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <PodcastDetail podcast={selectedPodcast} onBack={handleBack} />
          </motion.div>
        ) : (
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {currentTab === 'home' && <Home onSelectPodcast={handleSelectPodcast} />}
            {currentTab === 'search' && <Search onSelectPodcast={handleSelectPodcast} />}
            {currentTab === 'downloads' && <Downloads />}
            {currentTab === 'history' && <History />}
            {currentTab === 'settings' && <Settings />}
          </motion.div>
        )}
      </AnimatePresence>

      <Player />
      <BottomNav currentTab={currentTab} onChange={handleTabChange} />
    </div>
  );
}

