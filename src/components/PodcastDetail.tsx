import { useState, useEffect } from 'react';
import { ChevronLeft, Play, Pause, Download, Check, Loader2, Plus, Minus, X } from 'lucide-react';
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 relative overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] blur-[100px] opacity-50"
          style={{ 
            background: `radial-gradient(circle at center, var(--app-accent) 0%, transparent 70%)` 
          }}
        />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-white/5 pt-safe">
        <div className="flex items-center p-4">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors bg-white/5 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <h2 className="ml-4 text-sm font-black tracking-widest uppercase text-zinc-100 truncate opacity-0 animate-in fade-in duration-500 delay-300">
            {podcast.collectionName}
          </h2>
        </div>
      </div>

      {/* Hero */}
      <div className="relative z-10 px-6 pt-8 pb-10">
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-end">
          <div className="relative group">
            <img 
              src={podcast.artworkUrl600} 
              alt={podcast.collectionName} 
              className="w-56 h-56 md:w-64 md:h-64 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)] object-cover transition-transform duration-700 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -inset-4 bg-accent/20 blur-3xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-accent mb-3">Podcast</p>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 leading-[0.9]">{podcast.collectionName}</h1>
            <p className="text-zinc-400 text-lg font-serif italic mb-8">{podcast.artistName}</p>
            
            <div className="flex items-center justify-center md:justify-start gap-4">
              <button 
                onClick={toggleSubscription}
                className={clsx(
                  "flex items-center gap-2 px-8 py-3.5 rounded-full font-black tracking-widest uppercase text-xs transition-all active:scale-95",
                  isSubscribed 
                    ? "bg-white/10 text-zinc-300 hover:bg-white/20" 
                    : "bg-white text-zinc-950 hover:bg-zinc-200 shadow-xl shadow-white/10"
                )}
              >
                {isSubscribed ? <Minus size={16} /> : <Plus size={16} />}
                {isSubscribed ? "Inscrito" : "Inscrever-se"}
              </button>
            </div>
          </div>
        </div>
        
        {description && (
          <div className="mt-12 max-w-3xl">
            <h3 className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-500 mb-4">Sobre este podcast</h3>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
              {description}
            </p>
          </div>
        )}
      </div>

      {/* Episodes */}
      <div className="relative z-10 px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black tracking-tighter">Episódios</h2>
          <span className="text-[10px] font-black tracking-widest uppercase text-zinc-500">{episodes.length} Total</span>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-accent" size={32} />
            <p className="text-[10px] font-black tracking-widest uppercase text-zinc-600">Carregando episódios...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {episodes.slice(0, visibleCount).map((episode, index) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              const isDownloaded = downloads.some(d => d.id === episode.id);
              
              return (
                <div 
                  key={episode.id} 
                  className="group flex flex-col gap-4 p-5 rounded-3xl hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-white/5"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest">
                          {(() => {
                            if (!episode.pubDate) return 'Data Desconhecida';
                            const date = new Date(episode.pubDate);
                            if (isNaN(date.getTime())) return 'Data Desconhecida';
                            return format(date, "d 'de' MMM.", { locale: ptBR });
                          })()}
                        </span>
                        {index === 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-accent text-zinc-950 text-[8px] font-black uppercase tracking-tighter">Recente</span>
                        )}
                      </div>
                      <h3 className={clsx(
                        "font-black text-lg leading-tight mb-2 tracking-tight transition-colors",
                        currentEpisode?.id === episode.id ? "text-accent" : "text-zinc-100 group-hover:text-white"
                      )}>
                        {episode.title}
                      </h3>
                      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed font-medium">
                        {episode.description}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 relative">
                      <img 
                        src={episode.episodeArtwork || episode.podcastArtwork} 
                        alt={episode.title} 
                        className="w-20 h-20 rounded-2xl object-cover bg-zinc-900 shadow-lg ring-1 ring-white/5"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => handlePlay(episode)}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl backdrop-blur-[2px]"
                      >
                        <div className="w-10 h-10 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                          {isPlayingThis ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handlePlay(episode)}
                        className={clsx(
                          "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-all",
                          isPlayingThis ? "bg-accent text-zinc-950" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                        )}
                      >
                        {isPlayingThis ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                        {isPlayingThis ? 'Pausar' : 'Ouvir'}
                      </button>
                      {episode.duration && (
                        <span className="text-[10px] font-black text-zinc-500 tracking-widest uppercase">{formatDuration(episode.duration)}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center">
                      {downloadProgress[episode.id] !== undefined ? (
                        <div className="relative w-10 h-10 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" className="text-white/5" stroke="currentColor" strokeWidth="2" />
                            <circle 
                              cx="18" cy="18" r="16" fill="none" className="text-accent transition-all duration-300" 
                              stroke="currentColor" strokeWidth="2" strokeDasharray={`${downloadProgress[episode.id]}, 100`}
                            />
                          </svg>
                          <span className="absolute text-[8px] font-black text-accent">
                            {downloadProgress[episode.id]}%
                          </span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleDownload(episode, isDownloaded)}
                          className={clsx(
                            "p-2.5 rounded-full transition-all active:scale-90",
                            isDownloaded 
                              ? "text-accent bg-accent/10" 
                              : "text-zinc-500 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {isDownloaded ? <Check size={18} /> : <Download size={18} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {visibleCount < episodes.length && (
              <div className="flex justify-center pt-10 pb-6">
                <button
                  onClick={() => setVisibleCount(prev => prev + 50)}
                  className="px-8 py-3 rounded-full border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white transition-all text-[10px] font-black tracking-widest uppercase"
                >
                  Carregar Mais Episódios
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
