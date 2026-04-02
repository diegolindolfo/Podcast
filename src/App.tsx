import { useState, useEffect, lazy, Suspense } from 'react';
import { Home } from './components/Home';
import { BottomNav } from './components/BottomNav';
import { Player } from './components/Player';
import { useStore } from './store';
import { Podcast } from './types';
import { deleteDownloadedEpisode, downloadEpisode } from './services/downloader';
import { getPodcastFeed } from './services/api';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

import { motion, AnimatePresence } from 'motion/react';

const Search = lazy(() => import('./components/Search').then((m) => ({ default: m.Search })));
const Downloads = lazy(() => import('./components/Downloads').then((m) => ({ default: m.Downloads })));
const History = lazy(() => import('./components/History').then((m) => ({ default: m.History })));
const Settings = lazy(() => import('./components/Settings').then((m) => ({ default: m.Settings })));
const PodcastDetail = lazy(() => import('./components/PodcastDetail').then((m) => ({ default: m.PodcastDetail })));

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
    loadTheme,
    theme,
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
    loadTheme();
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

  // Sync push subscriptions to Firestore
  useEffect(() => {
    const subId = localStorage.getItem('pushSubId');
    if (subId) {
      const podcastUrls = subscriptions.map(p => p.feedUrl);
      updateDoc(doc(db, 'pushSubscriptions', subId), {
        podcasts: podcastUrls
      }).catch(err => {
        console.error('Failed to sync push subscriptions:', err);
      });
    }
  }, [subscriptions]);

  useEffect(() => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

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
            <Suspense fallback={<div className="p-4 text-text-muted">Carregando...</div>}><PodcastDetail podcast={selectedPodcast} onBack={handleBack} /></Suspense>
          </motion.div>
        ) : (
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {currentTab === 'home' && <Home onSelectPodcast={handleSelectPodcast} onGoToSearch={() => handleTabChange('search')} />}
            {currentTab === 'search' && <Suspense fallback={<div className="p-4 text-text-muted">Carregando...</div>}><Search onSelectPodcast={handleSelectPodcast} /></Suspense>}
            {currentTab === 'downloads' && <Suspense fallback={<div className="p-4 text-text-muted">Carregando...</div>}><Downloads /></Suspense>}
            {currentTab === 'history' && <Suspense fallback={<div className="p-4 text-text-muted">Carregando...</div>}><History /></Suspense>}
            {currentTab === 'settings' && <Suspense fallback={<div className="p-4 text-text-muted">Carregando...</div>}><Settings /></Suspense>}
          </motion.div>
        )}
      </AnimatePresence>

      <Player />
      <BottomNav currentTab={currentTab} onChange={handleTabChange} />
    </div>
  );
}

