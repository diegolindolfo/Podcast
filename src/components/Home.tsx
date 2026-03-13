import { useEffect } from 'react';
import { useStore } from '../store';
import { Podcast, Episode } from '../types';
import { getPodcastFeed } from '../services/api';
import { downloadEpisode } from '../services/downloader';

interface HomeProps {
  onSelectPodcast: (podcast: Podcast) => void;
}

import { motion } from 'motion/react';

export function Home({ onSelectPodcast }: HomeProps) {
  const { 
    subscriptions, 
    podcastLastViewed, 
    podcastLatestEpisode, 
    setPodcastLatestEpisode,
    settings,
    downloads
  } = useStore();

  useEffect(() => {
    // Check for new episodes in the background
    const checkNewEpisodes = async () => {
      await Promise.all(subscriptions.map(async (podcast) => {
        try {
          const feed = await getPodcastFeed(podcast.feedUrl);
          if (feed.items && feed.items.length > 0) {
            const latestItem = feed.items[0];
            const latestDate = latestItem.pubDate ? new Date(latestItem.pubDate).getTime() : 0;
            
            if (!isNaN(latestDate) && latestDate > 0) {
              const prevLatest = podcastLatestEpisode[podcast.collectionId] || 0;
              setPodcastLatestEpisode(podcast.collectionId, latestDate);

              // Auto-download logic
              if (settings.autoDownload && latestDate > prevLatest) {
                const isDownloaded = downloads.some(d => d.audioUrl === latestItem.enclosure?.url);
                if (!isDownloaded) {
                  // Map feed item to Episode type
                  const episode: Episode = {
                    id: latestItem.guid || latestItem.link || latestItem.title,
                    title: latestItem.title,
                    pubDate: latestItem.pubDate,
                    description: latestItem.contentSnippet || latestItem.content || latestItem['itunes:summary'] || '',
                    audioUrl: latestItem.enclosure?.url || '',
                    duration: latestItem['itunes:duration'],
                    podcastId: podcast.collectionId,
                    podcastName: podcast.collectionName,
                    podcastArtwork: podcast.artworkUrl600,
                    episodeArtwork: latestItem['itunes:image']?.$.href || latestItem['itunes:image'] || latestItem.itunes?.image || podcast.artworkUrl600
                  };
                  
                  if (episode.audioUrl) {
                    console.log(`Auto-downloading: ${episode.title}`);
                    downloadEpisode(episode).catch(err => console.error('Auto-download failed', err));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Failed to check new episodes for ${podcast.collectionName}`, error);
        }
      }));
    };

    checkNewEpisodes();
  }, [subscriptions, setPodcastLatestEpisode, settings.autoDownload, downloads]);

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Biblioteca</h1>
        <p className="text-zinc-500 text-sm mt-1">Seus podcasts inscritos</p>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
            <span className="text-4xl filter drop-shadow-lg">🎧</span>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">Nenhuma Inscrição</h2>
          <p className="text-zinc-400 text-base max-w-sm leading-relaxed">
            Pesquise por seus podcasts favoritos na aba Descobrir e inscreva-se para acompanhá-los aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {subscriptions.map((podcast, index) => {
            const lastViewed = podcastLastViewed[podcast.collectionId] || 0;
            const latestEpisode = podcastLatestEpisode[podcast.collectionId] || 0;
            const hasNewEpisode = latestEpisode > lastViewed;

            return (
              <motion.button
                key={podcast.collectionId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectPodcast(podcast)}
                className="text-left group flex flex-col relative"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 mb-3 shadow-lg shadow-black/40 border border-white/5">
                  <img
                    src={podcast.artworkUrl600}
                    alt={podcast.collectionName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {hasNewEpisode && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-accent text-zinc-950 text-[10px] font-black px-2 py-1 rounded-full shadow-xl animate-pulse ring-2 ring-black/20">
                      <div className="w-1.5 h-1.5 bg-zinc-950 rounded-full" />
                      NOVO
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-sm line-clamp-2 leading-tight group-hover:text-accent transition-colors">
                  {podcast.collectionName}
                </h3>
                <p className="text-xs text-zinc-500 truncate mt-1.5 font-medium">{podcast.artistName}</p>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
