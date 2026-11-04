import { useState, useEffect, lazy, Suspense } from 'react';
import { Home } from './components/Home';
import { BottomNav } from './components/BottomNav';
import { Player } from './components/Player';
import { useStore } from './store';
import { Podcast } from './types';
import { deleteDownloadedEpisode } from './services/downloader';
import { parseRssEpisode } from './utils';

import { motion, AnimatePresence } from 'motion/react';

// Lazy load components that are not needed immediately
const Search = lazy(() => import('./components/Search').then(m => ({ default: m.Search })));
const Downloads = lazy(() => import('./components/Downloads').then(m => ({ default: m.Downloads })));
const History = lazy(() => import('./components/History').then(m => ({ default: m.History })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const PodcastDetail = lazy(() => import('./components/PodcastDetail').then(m => ({ default: m.PodcastDetail })));

// Simple loading spinner for suspense fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[50vh]">
    <div className="w-8 h-8 border-4 border-accent-main border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);

  // Granular selectors to prevent unnecessary re-renders when playback progress ticks
  const theme = useStore((state) => state.theme);
  const settings = useStore((state) => state.settings);
  const finishedAt = useStore((state) => state.finishedAt);
  const downloads = useStore((state) => state.downloads);
  const subscriptions = useStore((state) => state.subscriptions);

  useEffect(() => {
    const s = useStore.getState();
    s.loadSubscriptions();
    s.loadDownloads();
    s.loadSavedProgress();
    s.loadListenedPodcasts();
    s.loadPodcastTimestamps();
    s.loadCurrentEpisode();
    s.loadHistory();
    s.loadQueue();
    s.loadSettings();
    s.loadFinishedAt();
    s.loadTheme();
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

  // Auto-download logic
  useEffect(() => {
    if (!settings.autoDownload || subscriptions.length === 0) return;

    const checkAndDownload = async () => {
      const { subscriptions: currentSubs, downloads: currentDls } = useStore.getState();
      const { getPodcastFeed } = await import('./services/api');
      const { downloadEpisode } = await import('./services/downloader');

      for (const podcast of currentSubs) {
        try {
          const feed = await getPodcastFeed(podcast.feedUrl);
          if (feed.items && feed.items.length > 0) {
            const latestItem = feed.items[0];
            const episode = parseRssEpisode(latestItem, podcast);
            
            // Check if already downloaded
            const isDownloaded = currentDls.some(d => d.id === episode.id);
            if (!isDownloaded && episode.audioUrl) {
              console.log(`Auto-downloading new episode from ${podcast.collectionName}: ${episode.title}`);
              await downloadEpisode(episode);
            }
          }
        } catch (error) {
          console.error(`Auto-download failed for ${podcast.collectionName}:`, error);
        }
      }
    };

    // Check every 4 hours
    const interval = setInterval(checkAndDownload, 4 * 60 * 60 * 1000);
    checkAndDownload();

    return () => clearInterval(interval);
  }, [settings.autoDownload, subscriptions]);

  useEffect(() => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ tab: 'home', podcast: null }, '');
    } else {
      if (window.history.state.tab) setCurrentTab(window.history.state.tab);
      if (window.history.state.podcast !== undefined) setSelectedPodcast(window.history.state.podcast);
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        setCurrentTab(e.state.tab || 'home');
        setSelectedPodcast(e.state.podcast || null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: string) => {
    if (tab === currentTab && !selectedPodcast) return;
    window.history.pushState({ tab, podcast: null }, '');
    setCurrentTab(tab);
    setSelectedPodcast(null);
  };

  const handleSelectPodcast = (podcast: Podcast) => {
    window.history.pushState({ tab: currentTab, podcast }, '');
    setSelectedPodcast(podcast);
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="bg-bg-main min-h-screen text-text-main font-sans">
      <AnimatePresence mode="wait">
        {selectedPodcast ? (
          <motion.div
            key="podcast-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Suspense fallback={<LoadingFallback />}>
              <PodcastDetail podcast={selectedPodcast} onBack={handleBack} />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Suspense fallback={<LoadingFallback />}>
              {currentTab === 'home' && <Home onSelectPodcast={handleSelectPodcast} />}
              {currentTab === 'search' && <Search onSelectPodcast={handleSelectPodcast} />}
              {currentTab === 'downloads' && <Downloads />}
              {currentTab === 'history' && <History />}
              {currentTab === 'settings' && <Settings />}
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      <Player />
      <BottomNav currentTab={currentTab} onChange={handleTabChange} />
    </div>
  );
}
