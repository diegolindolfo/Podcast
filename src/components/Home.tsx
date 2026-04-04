import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Podcast, Episode } from '../types';
import { getPodcastFeed } from '../services/api';
import { downloadEpisode } from '../services/downloader';
import { Play } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDuration } from '../utils';
import { motion } from 'motion/react';

interface HomeProps {
  onSelectPodcast: (podcast: Podcast) => void;
}

export function Home({ onSelectPodcast }: HomeProps) {
  const { 
    subscriptions, 
    podcastLastViewed, 
    podcastLatestEpisode,
    setCurrentEpisode,
    setIsPlaying,
    currentEpisode,
    isPlaying
  } = useStore();

  const [latestEpisodes, setLatestEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    if (subscriptions.length === 0) {
      setLatestEpisodes([]);
      return;
    }

    let active = true;
    const fetchLatest = async () => {
      setLoadingEpisodes(true);
      try {
        const promises = subscriptions.map(async (pod) => {
          try {
            const feed = await getPodcastFeed(pod.feedUrl);
            if (feed && feed.items && feed.items.length > 0) {
              const item = feed.items[0];
              
              let episodeArtwork = pod.artworkUrl600;
              if (item['itunes:image'] && typeof item['itunes:image'] === 'object' && item['itunes:image'].$) {
                episodeArtwork = item['itunes:image'].$.href;
              } else if (typeof item['itunes:image'] === 'string') {
                episodeArtwork = item['itunes:image'];
              } else if (item.itunes?.image) {
                episodeArtwork = item.itunes.image;
              }

              return {
                id: item.guid || item.link || item.title,
                title: item.title,
                pubDate: item.pubDate,
                description: item.contentSnippet || item.content || item['itunes:summary'] || '',
                audioUrl: item.enclosure?.url || '',
                duration: item['itunes:duration'],
                podcastId: pod.collectionId,
                podcastName: pod.collectionName,
                podcastArtwork: pod.artworkUrl600,
                episodeArtwork
              } as Episode;
            }
          } catch (e) {
            console.error("Failed to fetch feed for", pod.collectionName);
          }
          return null;
        });

        const results = await Promise.all(promises);
        if (!active) return;

        const validEpisodes = results.filter((e): e is Episode => e !== null && !!e.audioUrl);
        validEpisodes.sort((a, b) => {
          const dateA = new Date(a.pubDate || 0).getTime();
          const dateB = new Date(b.pubDate || 0).getTime();
          return dateB - dateA;
        });

        setLatestEpisodes(validEpisodes.slice(0, 10)); // Top 10 latest
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoadingEpisodes(false);
      }
    };

    fetchLatest();
    return () => { active = false; };
  }, [subscriptions]);

  const handlePlayEpisode = async (episode: Episode) => {
    if (currentEpisode?.id === episode.id) {
      setIsPlaying(!isPlaying);
    } else {
      await setCurrentEpisode(episode);
      setIsPlaying(true);
    }
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-bg-main">
      <div className="pt-safe pb-6">
        <h1 className="text-2xl font-bold text-text-main">Início</h1>
        <p className="text-text-muted text-sm">Seus podcasts e episódios recentes</p>
      </div>

      {latestEpisodes.length > 0 && (
        <div className="mb-8 -mx-4">
          <h2 className="text-lg font-bold text-text-main mb-4 px-4">Últimos Episódios</h2>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {latestEpisodes.map((episode, index) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              
              return (
                <motion.div
                  key={episode.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="snap-start shrink-0 w-72 bg-bg-surface hover:bg-bg-surface-hover transition-colors border border-border-subtle rounded-2xl p-4 flex flex-col gap-3 cursor-pointer"
                  onClick={() => handlePlayEpisode(episode)}
                >
                  <div className="flex gap-3">
                    <div className="relative w-16 h-16 shrink-0">
                      <img 
                        src={episode.episodeArtwork || episode.podcastArtwork} 
                        className="w-full h-full rounded-xl object-cover shadow-md" 
                        alt={episode.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      {isPlayingThis && (
                        <div className="absolute inset-0 bg-accent-main/20 flex items-center justify-center rounded-xl">
                          <div className="flex gap-0.5 items-end h-4">
                            <div className="w-1 bg-accent-text animate-[music-bar_0.6s_ease-in-out_infinite]" />
                            <div className="w-1 bg-accent-text animate-[music-bar_0.8s_ease-in-out_infinite]" />
                            <div className="w-1 bg-accent-text animate-[music-bar_0.7s_ease-in-out_infinite]" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={
                        `font-bold text-sm line-clamp-2 leading-tight transition-colors ${isPlayingThis ? 'text-accent-main' : 'text-text-main'}`
                      }>
                        {episode.title}
                      </h3>
                      <p className="text-xs text-text-muted truncate mt-1">{episode.podcastName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {episode.pubDate && (
                        <span className="bg-bg-surface-hover px-1.5 py-0.5 rounded-md">
                          {(() => {
                            const date = new Date(episode.pubDate);
                            return isNaN(date.getTime()) ? '' : format(date, "d MMM", { locale: ptBR });
                          })()}
                        </span>
                      )}
                      {episode.duration && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(episode.duration)}</span>
                        </>
                      )}
                    </div>
                    <button 
                      className="w-8 h-8 rounded-full bg-accent-main text-accent-text flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                      onClick={(e) => { e.stopPropagation(); handlePlayEpisode(episode); }}
                    >
                      <Play size={14} className="ml-0.5" fill="currentColor" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-bold text-text-main mb-4">Inscrições</h2>
        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center px-4">
            <div className="w-20 h-20 bg-bg-surface rounded-full flex items-center justify-center mb-6 border border-border-subtle">
              <span className="text-3xl">🎧</span>
            </div>
            <h2 className="text-xl font-bold mb-2 text-text-main">Nenhuma Inscrição</h2>
            <p className="text-text-muted text-sm max-w-xs">
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
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-bg-surface mb-2 border border-border-subtle">
                    <img
                      src={podcast.artworkUrl600}
                      alt={podcast.collectionName}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    
                    {hasNewEpisode && (
                      <div className="absolute top-2 right-2 bg-accent-main text-accent-text text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        NOVO
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-accent-main transition-colors text-text-main">
                    {podcast.collectionName}
                  </h3>
                  <p className="text-xs text-text-muted truncate mt-1">{podcast.artistName}</p>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
