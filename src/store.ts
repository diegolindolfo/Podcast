import { create } from 'zustand';
import { Episode, Podcast, DownloadedEpisode } from './types';
import { get, set, del } from 'idb-keyval';

interface PlayerState {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  playbackRate: number;
  volume: number;
  subscriptions: Podcast[];
  listenedPodcasts: Podcast[];
  downloads: DownloadedEpisode[];
  savedProgress: Record<string, number>;
  sleepTimer: number | null; // minutes remaining or timestamp
  accentColor: string;
  podcastLastViewed: Record<number, number>;
  podcastLatestEpisode: Record<number, number>;
  
  setCurrentEpisode: (episode: Episode | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  setAccentColor: (color: string) => void;
  
  subscribe: (podcast: Podcast) => Promise<void>;
  unsubscribe: (podcastId: number) => Promise<void>;
  loadSubscriptions: () => Promise<void>;
  clearSubscriptions: () => Promise<void>;
  
  addListenedPodcast: (podcast: Podcast) => Promise<void>;
  loadListenedPodcasts: () => Promise<void>;
  
  addDownload: (episode: DownloadedEpisode) => Promise<void>;
  removeDownload: (episodeId: string) => Promise<void>;
  loadDownloads: () => Promise<void>;
  clearDownloads: () => Promise<void>;

  saveEpisodeProgress: (episodeId: string, progress: number) => Promise<void>;
  loadSavedProgress: () => Promise<void>;

  setPodcastLastViewed: (podcastId: number, timestamp: number) => Promise<void>;
  setPodcastLatestEpisode: (podcastId: number, timestamp: number) => Promise<void>;
  loadPodcastTimestamps: () => Promise<void>;
}

export const useStore = create<PlayerState>((setStore, getStore) => ({
  currentEpisode: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,
  subscriptions: [],
  listenedPodcasts: [],
  downloads: [],
  savedProgress: {},
  sleepTimer: null,
  accentColor: '#10b981',
  podcastLastViewed: {},
  podcastLatestEpisode: {},

  setCurrentEpisode: (episode) => setStore({ currentEpisode: episode }),
  setIsPlaying: (isPlaying) => setStore({ isPlaying }),
  setProgress: (progress) => setStore({ progress }),
  setDuration: (duration) => setStore({ duration }),
  setPlaybackRate: (playbackRate) => setStore({ playbackRate }),
  setVolume: (volume) => setStore({ volume }),
  setSleepTimer: (sleepTimer) => setStore({ sleepTimer }),
  setAccentColor: (accentColor) => setStore({ accentColor }),

  subscribe: async (podcast) => {
    const subs = [...getStore().subscriptions, podcast];
    await set('subscriptions', subs);
    setStore({ subscriptions: subs });
    
    // Set initial last viewed to now so we don't show a dot immediately
    const currentLastViewed = getStore().podcastLastViewed;
    const updatedLastViewed = { ...currentLastViewed, [podcast.collectionId]: Date.now() };
    await set('podcastLastViewed', updatedLastViewed);
    setStore({ podcastLastViewed: updatedLastViewed });
  },
  
  unsubscribe: async (podcastId) => {
    const subs = getStore().subscriptions.filter(p => p.collectionId !== podcastId);
    await set('subscriptions', subs);
    setStore({ subscriptions: subs });
  },
  
  loadSubscriptions: async () => {
    const subs = await get<Podcast[]>('subscriptions') || [];
    setStore({ subscriptions: subs });
  },

  clearSubscriptions: async () => {
    await set('subscriptions', []);
    setStore({ subscriptions: [] });
  },

  addListenedPodcast: async (podcast) => {
    const current = getStore().listenedPodcasts;
    // Remove if already exists to move it to the top
    const filtered = current.filter(p => p.collectionId !== podcast.collectionId);
    const updated = [podcast, ...filtered].slice(0, 50); // Keep last 50
    await set('listenedPodcasts', updated);
    setStore({ listenedPodcasts: updated });
  },

  loadListenedPodcasts: async () => {
    const listened = await get<Podcast[]>('listenedPodcasts') || [];
    setStore({ listenedPodcasts: listened });
  },

  addDownload: async (episode) => {
    const dls = [...getStore().downloads, episode];
    await set('downloads', dls);
    setStore({ downloads: dls });
  },

  removeDownload: async (episodeId) => {
    const dls = getStore().downloads.filter(d => d.id !== episodeId);
    await set('downloads', dls);
    setStore({ downloads: dls });
  },

  loadDownloads: async () => {
    const dls = await get<DownloadedEpisode[]>('downloads') || [];
    setStore({ downloads: dls });
  },

  clearDownloads: async () => {
    await set('downloads', []);
    setStore({ downloads: [] });
  },

  saveEpisodeProgress: async (episodeId, progress) => {
    const currentProgress = getStore().savedProgress;
    const updated = { ...currentProgress, [episodeId]: progress };
    await set('savedProgress', updated);
    setStore({ savedProgress: updated });
  },

  loadSavedProgress: async () => {
    const progress = await get<Record<string, number>>('savedProgress') || {};
    setStore({ savedProgress: progress });
  },

  setPodcastLastViewed: async (podcastId, timestamp) => {
    const current = getStore().podcastLastViewed;
    const updated = { ...current, [podcastId]: timestamp };
    await set('podcastLastViewed', updated);
    setStore({ podcastLastViewed: updated });
  },

  setPodcastLatestEpisode: async (podcastId, timestamp) => {
    const current = getStore().podcastLatestEpisode;
    const updated = { ...current, [podcastId]: timestamp };
    await set('podcastLatestEpisode', updated);
    setStore({ podcastLatestEpisode: updated });
  },

  loadPodcastTimestamps: async () => {
    const lastViewed = await get<Record<number, number>>('podcastLastViewed') || {};
    const latestEpisode = await get<Record<number, number>>('podcastLatestEpisode') || {};
    setStore({ podcastLastViewed: lastViewed, podcastLatestEpisode: latestEpisode });
  }
}));
