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
    isPlaying,
    history,
    savedProgress,
    finishedAt
  } = useStore();

  const [latestEpisodes, setLatestEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

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
    <div className="p-4 pb-28 min-h-screen bg-bg-main">
      {/* Bento Header Section */}
      <div className="pt-safe pb-8 flex flex-col gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-accent-lime rounded-2xl p-6 text-black relative overflow-hidden flex flex-col h-64 justify-between shadow-2xl"
        >
          {/* Decorative shapes to match reference */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-black/5 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />

          <div className="flex justify-between items-start z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Status da Biblioteca</span>
              <h1 className="text-3xl font-bold mt-1 tracking-tight">Ouvindo Agora</h1>
            </div>
            <div className="flex gap-2">
              <div className="p-2 bg-black/10 rounded-full backdrop-blur-sm">
                <Play size={18} fill="black" />
              </div>
            </div>
          </div>

          <div className="z-10">
            <h2 className="text-5xl font-black tracking-tighter leading-none mb-4">
              {subscriptions.length} <span className="text-2xl font-bold tracking-tight">Podcasts</span>
            </h2>
            <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
              <div className="h-full bg-black w-[65%] rounded-full" />
            </div>
            <div className="flex justify-between items-center mt-2 font-bold text-xs">
              <span className="opacity-60 text-[10px]">Meta de audição</span>
              <span className="text-[10px]">65%</span>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => pendingEpisode && handlePlayEpisode(pendingEpisode)}
            className={`flex-1 bg-white/5 rounded-2xl p-5 border border-white/5 backdrop-blur-3xl flex flex-col justify-between min-w-0 select-none duration-200 ${pendingEpisode ? "cursor-pointer hover:bg-white/10 active:scale-[0.98] transition-all" : ""}`}
          >
            <div>
              <div className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center mb-4">
                <div className={`w-2 h-2 rounded-full ${isPlaying && currentEpisode?.id === pendingEpisode?.id ? 'bg-accent-lime animate-pulse' : 'bg-text-muted'}`} />
              </div>
              <span className="text-[10px] font-black text-text-muted uppercase tracking-wider block">
                {currentEpisode?.id === pendingEpisode?.id ? 'Tocando Agora' : pendingEpisode ? 'Para Ouvir' : 'Próximo'}
              </span>
              <p className="font-bold text-sm mt-1 truncate max-w-full text-text-main">
                {pendingEpisode ? pendingEpisode.title : 'Nenhum pendente'}
              </p>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 bg-bg-surface rounded-2xl p-5 border border-white/5"
          >
            <h3 className="text-2xl font-bold leading-none mb-1">{latestEpisodes.length}</h3>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Novidades</p>
          </motion.div>
        </div>
      </div>

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
                  className="snap-start shrink-0 w-80 bg-bg-surface hover:bg-bg-surface-hover transition-all border border-white/5 rounded-2xl p-5 flex flex-col gap-4 cursor-pointer shadow-xl"
                  onClick={() => handlePlayEpisode(episode)}
                >
                  <div className="flex gap-4">
                    <div className="relative w-24 h-24 shrink-0">
                      <img 
                        src={episode.episodeArtwork || episode.podcastArtwork} 
                        className="w-full h-full rounded-xl object-cover shadow-2xl" 
                        alt={episode.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      {isPlayingThis && (
                        <div className="absolute inset-0 bg-accent-lime/20 flex items-center justify-center rounded-xl backdrop-blur-[2px]">
                          <div className="flex gap-1 items-end h-5">
                            <div className="w-1 bg-accent-lime animate-[music-bar_0.6s_ease-in-out_infinite]" />
                            <div className="w-1 bg-accent-lime animate-[music-bar_0.8s_ease-in-out_infinite]" />
                            <div className="w-1 bg-accent-lime animate-[music-bar_0.7s_ease-in-out_infinite]" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <h3 className={
                        `font-bold text-base line-clamp-2 leading-tight transition-colors ${isPlayingThis ? 'text-accent-lime' : 'text-text-main'}`
                      }>
                        {episode.title}
                      </h3>
                      <p className="text-xs text-text-muted font-bold truncate mt-1">{episode.podcastName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-tighter">
                      {episode.pubDate && (
                        <span className="bg-white/5 px-2 py-1 rounded-full border border-white/5">
                          {(() => {
                            const date = new Date(episode.pubDate);
                            return isNaN(date.getTime()) ? '' : format(date, "d MMM", { locale: ptBR });
                          })()}
                        </span>
                      )}
                      {episode.duration && (
                        <span className="bg-white/5 px-2 py-1 rounded-full border border-white/5">
                          {formatDuration(episode.duration)}
                        </span>
                      )}
                    </div>
                    <button 
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlayingThis ? 'bg-accent-lime text-black' : 'bg-text-main text-black'}`}
                      onClick={(e) => { e.stopPropagation(); handlePlayEpisode(episode); }}
                    >
                      <Play size={16} className={isPlayingThis ? "" : "ml-0.5"} fill="currentColor" />
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
                  className="text-left group flex flex-col bg-bg-surface rounded-2xl p-3 border border-white/5"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-bg-surface mb-3 shadow-lg">
                    <img
                      src={podcast.artworkUrl600}
                      alt={podcast.collectionName}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    
                    {hasNewEpisode && (
                      <div className="absolute top-3 right-3 w-3 h-3 bg-accent-lime rounded-full shadow-[0_0_15px_rgba(217,249,157,0.5)]" />
                    )}
                  </div>
                  <h3 className="font-bold text-sm line-clamp-1 leading-tight group-hover:text-accent-lime transition-colors text-text-main px-1">
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
