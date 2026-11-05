import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Podcast, Episode } from '../types';
import { getPodcastFeed } from '../services/api';
import { Play, Pause, RefreshCw, Compass, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDuration, parseDurationToSeconds, parseRssEpisode } from '../utils';
import { motion } from 'motion/react';
import { clsx } from 'clsx';

interface HomeProps {
  onSelectPodcast: (podcast: Podcast) => void;
  onExplore?: () => void;
}

export function Home({ onSelectPodcast, onExplore }: HomeProps) {
  const { 
    subscriptions, 
    podcastLastViewed, 
    podcastLatestEpisode,
    setPodcastLatestEpisode,
    setCurrentEpisode,
    setIsPlaying,
    currentEpisode,
    isPlaying,
    history,
    savedProgress,
    finishedAt
  } = useStore(useShallow((s) => ({
    subscriptions: s.subscriptions,
    podcastLastViewed: s.podcastLastViewed,
    podcastLatestEpisode: s.podcastLatestEpisode,
    setPodcastLatestEpisode: s.setPodcastLatestEpisode,
    setCurrentEpisode: s.setCurrentEpisode,
    setIsPlaying: s.setIsPlaying,
    currentEpisode: s.currentEpisode,
    isPlaying: s.isPlaying,
    history: s.history,
    savedProgress: s.savedProgress,
    finishedAt: s.finishedAt,
  })));

  const [latestEpisodes, setLatestEpisodes] = useState<Episode[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);

  // Find a pending/in-progress episode
  let pendingEpisode: Episode | null = currentEpisode;
  
  if (!pendingEpisode && history && history.length > 0) {
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

  const fetchLatest = useCallback(async () => {
    if (subscriptions.length === 0) {
      setLatestEpisodes([]);
      return;
    }

    setLoadingFeeds(true);
    try {
      const promises = subscriptions.map(async (pod) => {
        try {
          const feed = await getPodcastFeed(pod.feedUrl);
          if (feed && feed.items && feed.items.length > 0) {
            const item = feed.items[0];
            const ep = parseRssEpisode(item, pod);
            if (ep.pubDate) {
              const ts = new Date(ep.pubDate).getTime();
              if (!isNaN(ts)) {
                setPodcastLatestEpisode(pod.collectionId, ts);
              }
            }
            return ep;
          }
        } catch (e) {
          console.error("Failed to fetch feed for", pod.collectionName);
        }
        return null;
      });

      const results = await Promise.all(promises);
      const validEpisodes = results.filter((e): e is Episode => e !== null && !!e.audioUrl);
      validEpisodes.sort((a, b) => {
        const dateA = new Date(a.pubDate || 0).getTime();
        const dateB = new Date(b.pubDate || 0).getTime();
        return dateB - dateA;
      });

      setLatestEpisodes(validEpisodes.slice(0, 10));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingFeeds(false);
    }
  }, [subscriptions, setPodcastLatestEpisode]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  const handlePlayEpisode = async (episode: Episode) => {
    if (currentEpisode?.id === episode.id) {
      setIsPlaying(!isPlaying);
    } else {
      await setCurrentEpisode(episode);
      setIsPlaying(true);
    }
  };

  const getEpisodeProgressInfo = (episode: Episode) => {
    const saved = savedProgress[episode.id] || 0;
    const totalSec = parseDurationToSeconds(episode.duration);
    const isDone = finishedAt[episode.id] !== undefined;
    if (isDone) return { pct: 100, remainingText: 'Ouvido', isDone: true };
    if (saved <= 0) return { pct: 0, remainingText: null, isDone: false };
    if (totalSec && totalSec > 0) {
      const pct = Math.min(100, Math.round((saved / totalSec) * 100));
      const remMins = Math.max(1, Math.ceil((totalSec - saved) / 60));
      return { pct, remainingText: `Restam ${remMins} min`, isDone: false };
    }
    return { pct: 15, remainingText: `Em andamento`, isDone: false };
  };

  return (
    <div className="p-4 pb-36 min-h-screen bg-bg-main">
      {/* Header */}
      <div className="pt-safe pb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-main mb-1">Ouvindo Agora</h1>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-0.5">Seu feed de podcasts atualizados</p>
        </div>
        {subscriptions.length > 0 && (
          <button
            onClick={fetchLatest}
            disabled={loadingFeeds}
            title="Atualizar feeds"
            className="p-2.5 rounded-xl bg-bg-surface border border-white/5 text-text-muted hover:text-text-main hover:bg-bg-surface-hover transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={clsx(loadingFeeds && "animate-spin text-accent-main")} />
          </button>
        )}
      </div>

      {/* Continue Listening Hero Card */}
      {pendingEpisode && (() => {
        const isPlayingPending = currentEpisode?.id === pendingEpisode.id && isPlaying;
        const progInfo = getEpisodeProgressInfo(pendingEpisode);

        return (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => handlePlayEpisode(pendingEpisode)}
            className="mb-8 p-4 rounded-2xl bg-bg-surface hover:bg-bg-surface-hover border border-white/5 cursor-pointer transition-all duration-300 relative overflow-hidden group shadow-lg flex flex-col gap-3 min-w-0"
          >
            <div className="flex gap-4 items-center min-w-0">
              {/* Cover image */}
              <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-bg-main border border-white/5 shadow-md">
                <img 
                  src={pendingEpisode.episodeArtwork || pendingEpisode.podcastArtwork} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  alt={pendingEpisode.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                {isPlayingPending && (
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
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-accent-main">
                    {isPlayingPending ? 'Tocando Agora' : progInfo.pct > 0 ? 'Continuar Ouvindo' : 'Sugestão Recente'}
                  </span>
                  {progInfo.remainingText && (
                    <span className="text-[9px] font-bold text-text-muted">
                      • {progInfo.remainingText}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-sm leading-tight text-text-main line-clamp-1 group-hover:text-accent-main transition-colors duration-200">
                  {pendingEpisode.title}
                </h3>
                <p className="text-[11px] text-text-muted font-bold truncate mt-1">
                  {pendingEpisode.podcastName}
                </p>
              </div>
              
              <div className="flex items-center shrink-0">
                <div className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-md",
                  isPlayingPending
                    ? "bg-accent-main text-accent-text"
                    : "bg-white/10 group-hover:bg-accent-main group-hover:text-accent-text text-text-main"
                )}>
                  {isPlayingPending ? (
                    <Pause size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                  )}
                </div>
              </div>
            </div>

            {progInfo.pct > 0 && !progInfo.isDone && (
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-main rounded-full transition-all duration-300"
                  style={{ width: `${progInfo.pct}%` }}
                />
              </div>
            )}
          </motion.div>
        );
      })()}

      {/* Skeletons while loading latest episodes for the first time */}
      {loadingFeeds && latestEpisodes.length === 0 && subscriptions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 px-1">Últimos Episódios</h2>
          <div className="flex overflow-x-auto gap-4 pb-4 [&::-webkit-scrollbar]:hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shrink-0 w-80 h-36 bg-bg-surface border border-white/5 rounded-2xl p-4 flex flex-col justify-between animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-xl bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 bg-white/10 rounded w-11/12" />
                    <div className="h-3.5 bg-white/10 rounded w-3/4" />
                    <div className="h-2.5 bg-white/5 rounded w-1/2 mt-2" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-2.5 bg-white/5 rounded w-24" />
                  <div className="w-9 h-9 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {latestEpisodes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 px-1">Últimos Episódios</h2>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {latestEpisodes.map((episode, index) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              const progInfo = getEpisodeProgressInfo(episode);
              
              return (
                <motion.div
                  key={episode.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="snap-start shrink-0 w-80 bg-bg-surface hover:bg-bg-surface-hover transition-all border border-white/5 rounded-2xl p-4 flex flex-col gap-3 cursor-pointer shadow-lg relative overflow-hidden"
                  onClick={() => handlePlayEpisode(episode)}
                >
                  <div className="flex gap-4">
                    <div className="relative w-20 h-20 shrink-0">
                      <img 
                        src={episode.episodeArtwork || episode.podcastArtwork} 
                        className="w-full h-full rounded-xl object-cover shadow-md" 
                        alt={episode.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      {isPlayingThis && (
                        <div className="absolute inset-0 bg-accent-main/20 flex items-center justify-center rounded-xl backdrop-blur-[2px]">
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
                      {progInfo.isDone ? (
                        <span className="inline-flex items-center gap-1 text-accent-main font-bold">
                          <CheckCircle2 size={12} /> Ouvido
                        </span>
                      ) : progInfo.remainingText ? (
                        <span className="text-accent-main font-bold">{progInfo.remainingText}</span>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                    <button 
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${isPlayingThis ? 'bg-accent-main text-accent-text' : 'bg-text-main text-black hover:scale-105'}`}
                      onClick={(e) => { e.stopPropagation(); handlePlayEpisode(episode); }}
                    >
                      {isPlayingThis ? (
                        <Pause size={14} fill="currentColor" />
                      ) : (
                        <Play size={14} className="ml-0.5" fill="currentColor" />
                      )}
                    </button>
                  </div>
                  {progInfo.pct > 0 && !progInfo.isDone && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                      <div
                        className="h-full bg-accent-main transition-all"
                        style={{ width: `${progInfo.pct}%` }}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Suas Inscrições</h2>
          {subscriptions.length > 0 && (
            <span className="text-[10px] font-bold text-text-muted bg-bg-surface px-2 py-0.5 rounded-full border border-white/5">
              {subscriptions.length}
            </span>
          )}
        </div>
        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6 bg-bg-surface rounded-2xl border border-dashed border-white/10">
            <div className="w-16 h-16 bg-accent-main/10 text-accent-main rounded-full flex items-center justify-center mb-4">
              <Compass size={30} />
            </div>
            <h2 className="text-lg font-bold mb-1 text-text-main">Sua biblioteca está vazia</h2>
            <p className="text-text-muted text-xs max-w-xs mb-6 leading-relaxed">
              Explore os principais podcasts do Brasil ou pesquise seus programas favoritos para começar.
            </p>
            {onExplore && (
              <button
                onClick={onExplore}
                className="px-6 py-3 rounded-xl bg-accent-main text-accent-text text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                Explorar Podcasts
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
                  className="text-left group flex flex-col bg-bg-surface hover:bg-bg-surface-hover rounded-2xl p-3 border border-white/5 transition-all shadow-md"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-bg-surface mb-3 shadow-lg">
                    <img
                      src={podcast.artworkUrl600}
                      alt={podcast.collectionName}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    
                    {hasNewEpisode && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-accent-main text-accent-text text-[9px] font-black uppercase tracking-wider rounded-full shadow-lg">
                        Novo
                      </div>
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
