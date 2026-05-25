import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Podcast, Episode } from '../types';
import { getPodcastFeed } from '../services/api';
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
    isPlaying,
    history,
    savedProgress,
    finishedAt
  } = useStore();

  const [latestEpisodes, setLatestEpisodes] = useState<Episode[]>([]);

  // Find a pending/in-progress episode
  let pendingEpisode: Episode | null = currentEpisode;
  
  if (!pendingEpisode && history && history.length > 0) {
    // Find the first history episode that is not finished and has some progress saved
    const partiallyListened = history.find(ep => {
      const isFinished = finishedAt && finishedAt[ep.id];
      const prog = savedProgress && savedProgress[ep.id];
      return !isFinished && prog && prog > 0;
    });
    if (partiallyListened) {
      pendingEpisode = partiallyListened;
    }
  }

  // Fallback to the first latest episode if nothing is in progress
  if (!pendingEpisode && latestEpisodes.length > 0) {
    pendingEpisode = latestEpisodes[0];
  }

  useEffect(() => {
    if (subscriptions.length === 0) {
      setLatestEpisodes([]);
      return;
    }

    let active = true;
    const fetchLatest = async () => {
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
        // fetch finished
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
    <div className="p-4 pb-28 min-h-screen bg-bg-main">
      {/* Quiet Apple Podcasts Style Header */}
      <div className="pt-safe pb-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-text-main mb-1">Ouvindo Agora</h1>
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-0.5">Seu feed de podcasts atualizados</p>
      </div>

      {/* Sleek, Uncluttered Widescreen Continue Listening Card */}
      {pendingEpisode && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => handlePlayEpisode(pendingEpisode)}
          className="mb-8 p-4 rounded-xl bg-bg-surface hover:bg-bg-surface-hover border border-white/5 cursor-pointer transition-all duration-300 relative overflow-hidden group shadow-lg flex gap-4 min-w-0"
        >
          {/* Cover image */}
          <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-bg-main border border-white/5">
            <img 
              src={pendingEpisode.episodeArtwork || pendingEpisode.podcastArtwork} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              alt={pendingEpisode.title}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {isPlaying && currentEpisode?.id === pendingEpisode.id && (
              <div className="absolute inset-0 bg-accent-main/20 flex items-center justify-center backdrop-blur-[1px]">
                <div className="flex gap-1 items-end h-5">
                  <div className="w-1 bg-accent-main animate-[music-bar_0.6s_ease-in-out_infinite]" />
                  <div className="w-1 bg-accent-main animate-[music-bar_0.8s_ease-in-out_infinite]" />
                  <div className="w-1 bg-accent-main animate-[music-bar_0.7s_ease-in-out_infinite]" />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-[9px] font-black uppercase tracking-wider text-accent-main mb-0.5">
              {currentEpisode?.id === pendingEpisode.id && isPlaying ? 'Tocando Agora' : 'Para Ouvir'}
            </span>
            <h3 className="font-bold text-sm leading-tight text-text-main line-clamp-1 group-hover:text-accent-main transition-colors duration-200">
              {pendingEpisode.title}
            </h3>
            <p className="text-[11px] text-text-muted font-bold truncate mt-1">
              {pendingEpisode.podcastName}
            </p>
          </div>
          
          <div className="flex items-center shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/5 group-hover:bg-accent-main group-hover:text-accent-text flex items-center justify-center text-text-muted transition-all duration-300">
              <Play size={14} fill="currentColor" className="ml-0.5 group-hover:fill-current" />
            </div>
          </div>
        </motion.div>
      )}

      {latestEpisodes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 px-1">Últimos Episódios</h2>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {latestEpisodes.map((episode, index) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              
              return (
                <motion.div
                  key={episode.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="snap-start shrink-0 w-80 bg-bg-surface hover:bg-bg-surface-hover transition-all border border-white/5 rounded-xl p-4 flex flex-col gap-3 cursor-pointer shadow-lg"
                  onClick={() => handlePlayEpisode(episode)}
                >
                  <div className="flex gap-4">
                    <div className="relative w-20 h-20 shrink-0">
                      <img 
                        src={episode.episodeArtwork || episode.podcastArtwork} 
                        className="w-full h-full rounded-lg object-cover shadow-md" 
                        alt={episode.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      {isPlayingThis && (
                        <div className="absolute inset-0 bg-accent-main/20 flex items-center justify-center rounded-lg backdrop-blur-[2px]">
                          <div className="flex gap-1 items-end h-5">
                            <div className="w-1 bg-accent-main animate-[music-bar_0.6s_ease-in-out_infinite]" />
                            <div className="w-1 bg-accent-main animate-[music-bar_0.8s_ease-in-out_infinite]" />
                            <div className="w-1 bg-accent-main animate-[music-bar_0.7s_ease-in-out_infinite]" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <h3 className={
                        `font-semibold text-sm line-clamp-2 leading-tight transition-colors ${isPlayingThis ? 'text-accent-main' : 'text-text-main'}`
                      }>
                        {episode.title}
                      </h3>
                      <p className="text-[11px] text-text-muted font-bold truncate mt-1">{episode.podcastName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                      {episode.pubDate && (
                        <span>
                          {(() => {
                            const date = new Date(episode.pubDate);
                            return isNaN(date.getTime()) ? '' : format(date, "d MMM", { locale: ptBR });
                          })()}
                        </span>
                      )}
                      {episode.pubDate && episode.duration && <span>•</span>}
                      {episode.duration && (
                        <span>
                          {formatDuration(episode.duration)}
                        </span>
                      )}
                    </div>
                    <button 
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPlayingThis ? 'bg-accent-main text-accent-text' : 'bg-text-main text-black'}`}
                      onClick={(e) => { e.stopPropagation(); handlePlayEpisode(episode); }}
                    >
                      <Play size={14} className={isPlayingThis ? "" : "ml-0.5"} fill="currentColor" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 px-1">Suas Inscrições</h2>
        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[30vh] text-center px-4 bg-bg-surface rounded-2xl border border-dashed border-white/10">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🎧</span>
            </div>
            <h2 className="text-lg font-bold mb-1 text-text-main">Vazio</h2>
            <p className="text-text-muted text-[10px] uppercase font-bold tracking-widest max-w-xs">
              Pesquise podcasts para começar
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {subscriptions.map((podcast, index) => {
              const lastViewed = podcastLastViewed[podcast.collectionId] || 0;
              const latestEpisode = podcastLatestEpisode[podcast.collectionId] || 0;
              const hasNewEpisode = latestEpisode > lastViewed;

              return (
                <motion.button
                  key={podcast.collectionId}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelectPodcast(podcast)}
                  className="text-left group flex flex-col bg-bg-surface rounded-xl p-3 border border-white/5"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-bg-surface mb-3 shadow-lg">
                    <img
                      src={podcast.artworkUrl600}
                      alt={podcast.collectionName}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    
                    {hasNewEpisode && (
                      <div className="absolute top-3 right-3 w-3 h-3 bg-accent-main rounded-full" />
                    )}
                  </div>
                  <h3 className="font-bold text-sm line-clamp-1 leading-tight group-hover:text-accent-main transition-colors text-text-main px-1">
                    {podcast.collectionName}
                  </h3>
                  <p className="text-[10px] font-bold text-text-muted truncate mt-1 px-1 uppercase tracking-wider">{podcast.artistName}</p>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
