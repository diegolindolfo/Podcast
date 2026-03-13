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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 relative">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-white/5 pt-safe">
        <div className="flex items-center p-4">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
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
            className="w-48 h-48 sm:w-40 sm:h-40 rounded-xl shadow-xl object-cover"
            referrerPolicy="no-referrer"
          />
          
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold mb-1">{podcast.collectionName}</h1>
            <p className="text-zinc-400 text-sm mb-4">{podcast.artistName}</p>
            
            <button 
              onClick={toggleSubscription}
              className={clsx(
                "px-6 py-2 rounded-full text-sm font-semibold transition-all active:scale-95",
                isSubscribed 
                  ? "bg-zinc-800 text-zinc-300" 
                  : "bg-white text-zinc-950 hover:bg-zinc-200"
              )}
            >
              {isSubscribed ? "Inscrito" : "Inscrever-se"}
            </button>
          </div>
        </div>
        
        {description && (
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase text-zinc-500 mb-2">Sobre</h3>
            <p className="text-zinc-400 text-sm leading-relaxed line-clamp-3 hover:line-clamp-none cursor-pointer">
              {description}
            </p>
          </div>
        )}
      </div>

      {/* Episodes */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Episódios</h2>
          <span className="text-xs text-zinc-500">{episodes.length}</span>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-accent" size={24} />
            <p className="text-xs text-zinc-500">Carregando...</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {episodes.slice(0, visibleCount).map((episode) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              const isDownloaded = downloads.some(d => d.id === episode.id);
              
              return (
                <div 
                  key={episode.id} 
                  className="py-4 flex gap-4 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                        {(() => {
                          if (!episode.pubDate) return '';
                          const date = new Date(episode.pubDate);
                          if (isNaN(date.getTime())) return '';
                          return format(date, "d 'de' MMM.", { locale: ptBR });
                        })()}
                      </span>
                    </div>
                    <h3 className={clsx(
                      "font-semibold text-sm leading-snug mb-1 line-clamp-2",
                      currentEpisode?.id === episode.id ? "text-accent" : "text-zinc-100"
                    )}>
                      {episode.title}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-3">
                      {episode.description}
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handlePlay(episode)}
                        className={clsx(
                          "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                          isPlayingThis ? "bg-accent text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        )}
                      >
                        {isPlayingThis ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        {isPlayingThis ? 'Pausar' : 'Ouvir'}
                      </button>
                      
                      {episode.duration && (
                        <span className="text-[10px] text-zinc-500">{formatDuration(episode.duration)}</span>
                      )}

                      <div className="ml-auto">
                        {downloadProgress[episode.id] !== undefined ? (
                          <div className="text-[10px] font-bold text-accent">
                            {downloadProgress[episode.id]}%
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleDownload(episode, isDownloaded)}
                            className={clsx(
                              "p-1.5 rounded-full transition-all",
                              isDownloaded ? "text-accent" : "text-zinc-500 hover:text-white"
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
                  className="px-6 py-2 rounded-full border border-white/10 text-zinc-400 text-xs font-semibold"
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
