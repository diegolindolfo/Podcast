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
  } = useStore();

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950">
      <div className="pt-safe pb-6">
        <h1 className="text-2xl font-bold text-white">Biblioteca</h1>
        <p className="text-zinc-500 text-sm">Seus podcasts inscritos</p>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-white/5">
            <span className="text-3xl">🎧</span>
          </div>
          <h2 className="text-xl font-bold mb-2 text-white">Nenhuma Inscrição</h2>
          <p className="text-zinc-400 text-sm max-w-xs">
            Pesquise por seus podcasts favoritos na aba Descobrir e inscreva-se para acompanhá-los aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {subscriptions.map((podcast, index) => {
            const lastViewed = podcastLastViewed[podcast.collectionId] || 0;
            const latestEpisode = podcastLatestEpisode[podcast.collectionId] || 0;
            const hasNewEpisode = latestEpisode > lastViewed;

            return (
              <motion.button
                key={podcast.collectionId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectPodcast(podcast)}
                className="text-left group flex flex-col"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 mb-2 border border-white/5">
                  <img
                    src={podcast.artworkUrl600}
                    alt={podcast.collectionName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  
                  {hasNewEpisode && (
                    <div className="absolute top-2 right-2 bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                      NOVO
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                  {podcast.collectionName}
                </h3>
                <p className="text-xs text-zinc-500 truncate mt-1">{podcast.artistName}</p>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
