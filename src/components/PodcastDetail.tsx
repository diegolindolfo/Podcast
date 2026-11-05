import { useState, useEffect } from 'react';
import { ChevronLeft, Play, Pause, Download, Check, Plus, Search as SearchIcon, X, CheckCircle2 } from 'lucide-react';
import { Podcast, Episode } from '../types';
import { getPodcastFeed } from '../services/api';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { downloadEpisode, deleteDownloadedEpisode } from '../services/downloader';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatDuration, parseDurationToSeconds, parseRssEpisode, stripHtml } from '../utils';

interface PodcastDetailProps {
  podcast: Podcast;
  onBack: () => void;
}

export function PodcastDetail({ podcast, onBack }: PodcastDetailProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [visibleCount, setVisibleCount] = useState(50);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterBy, setFilterBy] = useState<'all' | 'unheard' | 'downloaded'>('all');
  const [episodeQuery, setEpisodeQuery] = useState('');
  
  const { 
    currentEpisode, 
    isPlaying, 
    setIsPlaying, 
    setCurrentEpisode,
    subscriptions,
    subscribe,
    unsubscribe,
    downloads,
    addListenedPodcast,
    setPodcastLastViewed,
    setPodcastLatestEpisode,
    addToQueue,
    queue,
    savedProgress,
    finishedAt,
    toggleEpisodeFinished
  } = useStore(useShallow((s) => ({
    currentEpisode: s.currentEpisode,
    isPlaying: s.isPlaying,
    setIsPlaying: s.setIsPlaying,
    setCurrentEpisode: s.setCurrentEpisode,
    subscriptions: s.subscriptions,
    subscribe: s.subscribe,
    unsubscribe: s.unsubscribe,
    downloads: s.downloads,
    addListenedPodcast: s.addListenedPodcast,
    setPodcastLastViewed: s.setPodcastLastViewed,
    setPodcastLatestEpisode: s.setPodcastLatestEpisode,
    addToQueue: s.addToQueue,
    queue: s.queue,
    savedProgress: s.savedProgress,
    finishedAt: s.finishedAt,
    toggleEpisodeFinished: s.toggleEpisodeFinished,
  })));

  const isSubscribed = subscriptions.some(p => p.collectionId === podcast.collectionId);

  useEffect(() => {
    setPodcastLastViewed(podcast.collectionId, Date.now());
  }, [podcast.collectionId, setPodcastLastViewed]);

  useEffect(() => {
    let active = true;
    const fetchFeed = async () => {
      try {
        const feed = await getPodcastFeed(podcast.feedUrl);
        if (!active) return;
        
        setDescription(stripHtml(feed.description || ''));
        
        const eps: Episode[] = feed.items
          .map((item: any) => parseRssEpisode(item, podcast))
          .filter((e: Episode) => !!e.audioUrl);
        
        setEpisodes(eps);

        if (eps.length > 0 && eps[0].pubDate) {
          const latestDate = new Date(eps[0].pubDate).getTime();
          if (!isNaN(latestDate)) {
            setPodcastLatestEpisode(podcast.collectionId, latestDate);
            setPodcastLastViewed(podcast.collectionId, Math.max(Date.now(), latestDate));
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    };
    
    fetchFeed();
    return () => { active = false; };
  }, [podcast.feedUrl, podcast, setPodcastLatestEpisode, setPodcastLastViewed]);

  const handlePlay = async (episode: Episode) => {
    if (currentEpisode?.id === episode.id) {
      setIsPlaying(!isPlaying);
    } else {
      await setCurrentEpisode(episode);
      setIsPlaying(true);
      addListenedPodcast(podcast);
    }
  };

  const handleDownload = async (episode: Episode, isDownloaded: boolean) => {
    if (isDownloaded) {
      await deleteDownloadedEpisode(episode.id, episode.audioUrl);
    } else {
      setDownloadProgress(prev => ({ ...prev, [episode.id]: 0 }));
      try {
        await downloadEpisode(episode, (progress) => {
          setDownloadProgress(prev => ({ ...prev, [episode.id]: progress }));
        });
      } catch (error) {
        console.error('Download failed', error);
      } finally {
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[episode.id];
          return newProgress;
        });
      }
    }
  };

  const toggleSubscription = () => {
    if (isSubscribed) {
      unsubscribe(podcast.collectionId);
    } else {
      subscribe(podcast);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main pb-36 relative">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-border-subtle pt-safe">
        <div className="flex items-center p-4">
          <button onClick={onBack} className="p-2 -ml-2 text-text-muted hover:text-text-main transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="ml-2 text-sm font-semibold truncate">
            {podcast.collectionName}
          </h2>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 pt-6 pb-8 border-b border-white/5">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <img 
            src={podcast.artworkUrl600} 
            alt={podcast.collectionName} 
            className="w-44 h-44 sm:w-40 sm:h-40 rounded-2xl shadow-2xl object-cover border border-white/5"
            referrerPolicy="no-referrer"
          />
          
          <div className="flex-1 text-center sm:text-left flex flex-col justify-center">
            <h1 className="text-2xl sm:text-3xl font-black mb-1 leading-tight tracking-tight">{podcast.collectionName}</h1>
            <p className="text-text-muted font-bold text-sm mb-4">{podcast.artistName}</p>
            
            <button 
              onClick={toggleSubscription}
              className={clsx(
                "px-8 py-3 rounded-xl text-xs uppercase tracking-wider font-black transition-all hover:scale-105 active:scale-95 shadow-lg self-center sm:self-start",
                isSubscribed 
                  ? "bg-white/5 text-text-muted border border-white/10" 
                  : "bg-accent-main text-accent-text"
              )}
            >
              {isSubscribed ? "✓ Inscrito" : "Inscrever-se"}
            </button>
          </div>
        </div>
        
        {description && (
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase text-text-muted mb-2">Sobre</h3>
            <p className={clsx(
              "text-text-muted text-sm leading-relaxed",
              !descExpanded && "line-clamp-3"
            )}>
              {description}
            </p>
            {description.length > 180 && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="mt-1.5 text-xs font-bold text-accent-main hover:underline"
              >
                {descExpanded ? 'Mostrar menos' : 'Ler mais'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Episodes */}
      <div className="px-4 py-6">
        {(() => {
          const normalizeText = (s?: string) =>
            (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const normalizedQuery = normalizeText(episodeQuery.trim());
          const filteredAndSortedEpisodes = episodes
            .filter(episode => {
              if (filterBy === 'downloaded' && !downloads.some(d => d.id === episode.id)) {
                return false;
              }
              if (filterBy === 'unheard' && finishedAt[episode.id] !== undefined) {
                return false;
              }
              if (normalizedQuery) {
                const inTitle = normalizeText(episode.title).includes(normalizedQuery);
                const inDesc = normalizeText(episode.description).includes(normalizedQuery);
                if (!inTitle && !inDesc) return false;
              }
              return true;
            })
            .sort((a, b) => {
              const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
              const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
              return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
            });

          return (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Episódios</h2>
                <span className="text-xs font-bold text-text-muted bg-bg-surface px-2.5 py-1 rounded-full border border-white/5">
                  {filteredAndSortedEpisodes.length !== episodes.length 
                    ? `${filteredAndSortedEpisodes.length} de ${episodes.length}` 
                    : episodes.length}
                </span>
              </div>

              {!loading && (
                <div className="flex flex-col gap-3 mb-6">
                  {/* Busca de episódios dentro do podcast */}
                  <div className="relative">
                    <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      type="text"
                      value={episodeQuery}
                      onChange={(e) => { setEpisodeQuery(e.target.value); setVisibleCount(50); }}
                      placeholder="Buscar episódio por título ou assunto..."
                      className="w-full bg-bg-surface border border-white/5 rounded-2xl pl-10 pr-10 py-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent-main/50 transition-colors"
                    />
                    {episodeQuery && (
                      <button
                        onClick={() => { setEpisodeQuery(''); setVisibleCount(50); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-1"
                        title="Limpar busca"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Filtro e Ordenação */}
                  <div className="flex flex-wrap gap-2 justify-between items-center bg-bg-surface p-2 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl">
                      <button
                        onClick={() => setFilterBy('all')}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                          filterBy === 'all' ? "bg-accent-main text-accent-text" : "text-text-muted hover:text-text-main"
                        )}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => setFilterBy('unheard')}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                          filterBy === 'unheard' ? "bg-accent-main text-accent-text" : "text-text-muted hover:text-text-main"
                        )}
                      >
                        Não Ouvidos
                      </button>
                      <button
                        onClick={() => setFilterBy('downloaded')}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                          filterBy === 'downloaded' ? "bg-accent-main text-accent-text" : "text-text-muted hover:text-text-main"
                        )}
                      >
                        Baixados
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl">
                      <button
                        onClick={() => setSortBy('newest')}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                          sortBy === 'newest' ? "bg-accent-main text-accent-text" : "text-text-muted hover:text-text-main"
                        )}
                      >
                        Mais Recentes
                      </button>
                      <button
                        onClick={() => setSortBy('oldest')}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                          sortBy === 'oldest' ? "bg-accent-main text-accent-text" : "text-text-muted hover:text-text-main"
                        )}
                      >
                        Mais Antigos
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="space-y-4 py-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="py-4 flex gap-4 border-b border-white/5 animate-pulse">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-bg-surface shrink-0" />
                      <div className="flex-1 space-y-2.5 py-1">
                        <div className="h-2.5 bg-bg-surface rounded w-24" />
                        <div className="h-4 bg-bg-surface rounded w-4/5" />
                        <div className="h-3 bg-bg-surface rounded w-full" />
                        <div className="flex gap-3 pt-2">
                          <div className="h-9 w-24 bg-bg-surface rounded-xl" />
                          <div className="h-9 w-9 bg-bg-surface rounded-xl" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredAndSortedEpisodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-sm text-text-muted">Nenhum episódio encontrado com o filtro selecionado.</p>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {filteredAndSortedEpisodes.slice(0, visibleCount).map((episode) => {
                    const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
                    const isDownloaded = downloads.some(d => d.id === episode.id);
                    const isFinished = finishedAt[episode.id] !== undefined;
                    const savedSec = savedProgress[episode.id] || 0;
                    const totalSec = parseDurationToSeconds(episode.duration);
                    const progressPct = !isFinished && savedSec > 0 && totalSec
                      ? Math.min(100, Math.round((savedSec / totalSec) * 100))
                      : 0;
                    const remainingMins = !isFinished && savedSec > 0 && totalSec && totalSec > savedSec
                      ? Math.max(1, Math.ceil((totalSec - savedSec) / 60))
                      : null;
                    const cleanDesc = stripHtml(episode.description);
                    
                    return (
                      <div 
                        key={episode.id} 
                        className={clsx(
                          "py-5 flex gap-4 group border-b border-white/5 last:border-0 items-start transition-opacity",
                          isFinished && !isPlayingThis && "opacity-60 hover:opacity-100"
                        )}
                      >
                        {/* Capa do Episódio */}
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-bg-surface border border-white/5 shadow-md">
                          <img 
                            src={episode.episodeArtwork || episode.podcastArtwork || podcast.artworkUrl600} 
                            alt={episode.title} 
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          {isPlayingThis && (
                            <div className="absolute inset-0 bg-accent-main/25 flex items-center justify-center backdrop-blur-[1px]">
                              <div className="flex gap-1 items-end h-5">
                                <div className="w-1 bg-accent-text animate-[music-bar_0.6s_ease-in-out_infinite]" />
                                <div className="w-1 bg-accent-text animate-[music-bar_0.8s_ease-in-out_infinite]" />
                                <div className="w-1 bg-accent-text animate-[music-bar_0.7s_ease-in-out_infinite]" />
                              </div>
                            </div>
                          )}
                          {progressPct > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                              <div
                                className="h-full bg-accent-main"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-wide">
                            {isFinished && (
                              <span className="inline-flex items-center gap-1 text-accent-main font-bold">
                                <CheckCircle2 size={12} /> Ouvido •
                              </span>
                            )}
                            {episode.pubDate && (
                              <span>
                                {(() => {
                                  const date = new Date(episode.pubDate);
                                  if (isNaN(date.getTime())) return '';
                                  return format(date, "d 'de' MMM", { locale: ptBR });
                                })()}
                              </span>
                            )}
                            
                            {episode.pubDate && (episode.duration || remainingMins) && <span>•</span>}

                            {remainingMins ? (
                              <span className="text-accent-main font-bold">Restam {remainingMins} min</span>
                            ) : episode.duration ? (
                              <span>{formatDuration(episode.duration)}</span>
                            ) : null}
                          </div>
                          <h3 className={clsx(
                            "font-semibold text-base leading-snug mb-1.5 line-clamp-2 transition-colors",
                            currentEpisode?.id === episode.id ? "text-accent-main" : "text-text-main group-hover:text-accent-main"
                          )}>
                            {episode.title}
                          </h3>
                          {cleanDesc && (
                            <p className="text-xs text-text-muted line-clamp-2 mb-4 leading-relaxed">
                              {cleanDesc}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <button 
                              onClick={() => handlePlay(episode)}
                              className={clsx(
                                "flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-md",
                                isPlayingThis 
                                  ? "bg-accent-main text-accent-text" 
                                  : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-main"
                              )}
                            >
                              {isPlayingThis ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                              {isPlayingThis ? 'Pausar' : savedSec > 0 && !isFinished ? 'Continuar' : 'Ouvir'}
                            </button>

                            <button 
                              onClick={() => addToQueue(episode)}
                              disabled={queue.some(q => q.id === episode.id)}
                              className={clsx(
                                "flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-md",
                                queue.some(q => q.id === episode.id)
                                  ? "bg-accent-main/10 text-accent-main cursor-not-allowed"
                                  : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-main"
                              )}
                              title="Adicionar à fila"
                            >
                              <Plus size={16} />
                            </button>

                            <button
                              onClick={() => toggleEpisodeFinished(episode.id)}
                              className={clsx(
                                "flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-md",
                                isFinished
                                  ? "bg-accent-main/15 text-accent-main"
                                  : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-main"
                              )}
                              title={isFinished ? "Marcar como não ouvido" : "Marcar como ouvido"}
                            >
                              <CheckCircle2 size={16} />
                            </button>
       
                            <div className="ml-auto">
                              {downloadProgress[episode.id] !== undefined ? (
                                <div className="text-[10px] font-black text-accent-main uppercase tracking-widest bg-accent-main/10 px-3 py-1.5 rounded-xl animate-pulse">
                                  {downloadProgress[episode.id]}%
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handleDownload(episode, isDownloaded)}
                                  title={isDownloaded ? "Remover download" : "Baixar episódio"}
                                  className={clsx(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                                    isDownloaded 
                                      ? "text-accent-main bg-accent-main/10" 
                                      : "text-text-muted bg-white/5 hover:text-text-main hover:bg-white/10"
                                  )}
                                >
                                  {isDownloaded ? <Check size={16} /> : <Download size={16} />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {visibleCount < filteredAndSortedEpisodes.length && (
                    <div className="flex justify-center py-8">
                      <button
                        onClick={() => setVisibleCount(prev => prev + 50)}
                        className="px-6 py-2.5 rounded-xl bg-bg-surface border border-white/10 text-text-main hover:border-accent-main/40 text-xs font-bold transition-all"
                      >
                        Carregar mais episódios
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
