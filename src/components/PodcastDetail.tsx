import { useState, useEffect } from 'react';
import { ChevronLeft, Play, Pause, Download, Check, Loader2, Plus, Minus, X, Calendar, Clock } from 'lucide-react';
import { Podcast, Episode } from '../types';
import { getPodcastFeed } from '../services/api';
import { useStore } from '../store';
import { downloadEpisode, deleteDownloadedEpisode } from '../services/downloader';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { formatDuration } from '../utils';

interface PodcastDetailProps {
  podcast: Podcast;
  onBack: () => void;
}

export function PodcastDetail({ podcast, onBack }: PodcastDetailProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [visibleCount, setVisibleCount] = useState(50);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  
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
    setPodcastLatestEpisode
  } = useStore();

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
        
        setDescription(feed.description || '');
        
        const eps: Episode[] = feed.items.map((item: any) => {
          let episodeArtwork = podcast.artworkUrl600;
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
            podcastId: podcast.collectionId,
            podcastName: podcast.collectionName,
            podcastArtwork: podcast.artworkUrl600,
            episodeArtwork
          };
        }).filter((e: Episode) => e.audioUrl);
        
        setEpisodes(eps);

        if (eps.length > 0 && eps[0].pubDate) {
          const latestDate = new Date(eps[0].pubDate).getTime();
          if (!isNaN(latestDate)) {
            setPodcastLatestEpisode(podcast.collectionId, latestDate);
            // Update last viewed to be at least the latest episode date to clear the dot
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
  }, [podcast.feedUrl]);

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
    <div className="min-h-screen bg-bg-main text-text-main pb-24 relative">
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
            className="w-48 h-48 sm:w-40 sm:h-40 rounded-xl shadow-2xl object-cover border border-white/5"
            referrerPolicy="no-referrer"
          />
          
          <div className="flex-1 text-center sm:text-left flex flex-col justify-center">
            <h1 className="text-3xl font-black mb-1 leading-tight tracking-tight">{podcast.collectionName}</h1>
            <p className="text-text-muted font-bold text-sm mb-4">{podcast.artistName}</p>
            
            <button 
              onClick={toggleSubscription}
              className={clsx(
                "px-8 py-3 rounded-xl text-xs uppercase tracking-wider font-black transition-all hover:scale-105 active:scale-95 shadow-lg inline-self-center sm:inline-self-start",
                isSubscribed 
                  ? "bg-white/5 text-text-muted border border-white/5" 
                  : "bg-accent-main text-accent-text"
              )}
            >
              {isSubscribed ? "Inscrito" : "Inscrever-se"}
            </button>
          </div>
        </div>
        
        {description && (
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase text-text-muted mb-2">Sobre</h3>
            <p className="text-text-muted text-sm leading-relaxed line-clamp-3 hover:line-clamp-none cursor-pointer">
              {description}
            </p>
          </div>
        )}
      </div>

      {/* Episodes */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Episódios</h2>
          <span className="text-xs text-text-muted">{episodes.length}</span>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-accent-main" size={24} />
            <p className="text-xs text-text-muted">Carregando...</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {episodes.slice(0, visibleCount).map((episode) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              const isDownloaded = downloads.some(d => d.id === episode.id);
              
              return (                <div 
                  key={episode.id} 
                  className="py-5 flex gap-4 group border-b border-white/5 last:border-0 items-start"
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
                  </div>                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-wide">
                      {episode.pubDate && (
                        <span>
                          {(() => {
                            const date = new Date(episode.pubDate);
                            if (isNaN(date.getTime())) return '';
                            return format(date, "d 'de' MMM", { locale: ptBR });
                          })()}
                        </span>
                      )}
                      
                      {episode.pubDate && episode.duration && <span>•</span>}

                      {episode.duration && (
                        <span>{formatDuration(episode.duration)}</span>
                      )}
                    </div>
                    <h3 className={clsx(
                      "font-semibold text-base leading-snug mb-2 line-clamp-2 transition-colors",
                      currentEpisode?.id === episode.id ? "text-accent-main" : "text-text-main group-hover:text-accent-main"
                    )}>
                      {episode.title}
                    </h3>
                    <p className="text-xs text-text-muted line-clamp-2 mb-4 leading-relaxed">
                      {episode.description}
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handlePlay(episode)}
                        className={clsx(
                          "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-md",
                          isPlayingThis 
                            ? "bg-accent-main text-accent-text" 
                            : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-main"
                        )}
                      >
                        {isPlayingThis ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                        {isPlayingThis ? 'Pausar' : 'Ouvir'}
                      </button>
 
                      <div className="ml-auto">
                        {downloadProgress[episode.id] !== undefined ? (
                          <div className="text-[10px] font-black text-accent-main uppercase tracking-widest bg-accent-main/10 px-3 py-1.5 rounded-xl animate-pulse">
                            {downloadProgress[episode.id]}% Baixando
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleDownload(episode, isDownloaded)}
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
            
            {visibleCount < episodes.length && (
              <div className="flex justify-center py-8">
                <button
                  onClick={() => setVisibleCount(prev => prev + 50)}
                  className="px-6 py-2 rounded-full border border-border-subtle text-text-muted text-xs font-semibold"
                >
                  Ver mais
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
