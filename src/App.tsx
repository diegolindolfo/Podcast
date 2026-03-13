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
    downloads,
    subscriptions
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

  // Auto-download logic
  useEffect(() => {
    if (!settings.autoDownload) return;

    const checkAndDownload = async () => {
      const { subscriptions, downloads } = useStore.getState();
      const { getPodcastFeed } = await import('./services/api');
      const { downloadEpisode } = await import('./services/downloader');

      for (const podcast of subscriptions) {
        try {
          const feed = await getPodcastFeed(podcast.feedUrl);
          if (feed.items && feed.items.length > 0) {
            const latestItem = feed.items[0];
            const episodeId = latestItem.guid || latestItem.link || latestItem.title;
            
            // Check if already downloaded
            const isDownloaded = downloads.some(d => d.id === episodeId);
            if (!isDownloaded) {
              console.log(`Auto-downloading new episode from ${podcast.collectionName}: ${latestItem.title}`);
              
              // Construct episode object
              let episodeArtwork = podcast.artworkUrl600;
              if (latestItem['itunes:image'] && typeof latestItem['itunes:image'] === 'object' && latestItem['itunes:image'].$) {
                episodeArtwork = latestItem['itunes:image'].$.href;
              } else if (typeof latestItem['itunes:image'] === 'string') {
                episodeArtwork = latestItem['itunes:image'];
              } else if (latestItem.itunes?.image) {
                episodeArtwork = latestItem.itunes.image;
              }

              const episode = {
                id: episodeId,
                title: latestItem.title,
                pubDate: latestItem.pubDate,
                description: latestItem.contentSnippet || latestItem.content || latestItem['itunes:summary'] || '',
                audioUrl: latestItem.enclosure?.url || '',
                duration: latestItem['itunes:duration'],
                podcastId: podcast.collectionId,
                podcastName: podcast.collectionName,
                podcastArtwork: podcast.artworkUrl600,
                episodeArtwork
              };

              if (episode.audioUrl) {
                await downloadEpisode(episode);
              }
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

