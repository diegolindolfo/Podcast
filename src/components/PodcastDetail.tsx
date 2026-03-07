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

  const handlePlay = (episode: Episode) => {
    if (currentEpisode?.id === episode.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentEpisode(episode);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md pt-safe">
        <div className="flex items-center p-4">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft size={28} />
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="px-4 pb-6 border-b border-zinc-800/50">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <img 
            src={podcast.artworkUrl600} 
            alt={podcast.collectionName} 
            className="w-48 h-48 md:w-64 md:h-64 rounded-2xl shadow-2xl shadow-black/50 object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2 leading-tight">{podcast.collectionName}</h1>
            <p className="text-zinc-400 text-lg mb-6">{podcast.artistName}</p>
            
            <div className="flex items-center justify-center md:justify-start gap-4">
              <button 
                onClick={toggleSubscription}
                className={clsx(
                  "flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all",
                  isSubscribed 
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" 
                    : "bg-accent text-zinc-950 hover:bg-accent/90 shadow-lg shadow-accent/20"
                )}
              >
                {isSubscribed ? <Minus size={20} /> : <Plus size={20} />}
                {isSubscribed ? "Inscrito" : "Inscrever-se"}
              </button>
            </div>
          </div>
        </div>
        
        {description && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold tracking-widest uppercase text-zinc-500 mb-2">Sobre</h3>
            <p className="text-zinc-300 text-sm leading-relaxed line-clamp-4">{description}</p>
          </div>
        )}
      </div>

      {/* Episodes */}
      <div className="px-4 py-6">
        <h2 className="text-xl font-bold mb-6">Episódios</h2>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-accent" size={32} />
          </div>
        ) : (
          <div className="space-y-4">
            {episodes.slice(0, visibleCount).map((episode) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              const isDownloaded = downloads.some(d => d.id === episode.id);
              
              return (
                <div key={episode.id} className="group flex flex-col gap-3 p-4 border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          {episode.pubDate ? format(new Date(episode.pubDate), "d 'de' MMM.", { locale: ptBR }) : 'Data Desconhecida'}
                        </span>
                      </div>
                      <h3 className={clsx(
                        "font-semibold text-[15px] leading-snug mb-1",
                        currentEpisode?.id === episode.id ? "text-accent" : "text-zinc-100 group-hover:text-white"
                      )}>
                        {episode.title}
                      </h3>
                      <p className="text-[13px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {episode.description}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0">
                      <img 
                        src={episode.episodeArtwork || episode.podcastArtwork} 
                        alt={episode.title} 
                        className="w-16 h-16 rounded-lg object-cover bg-zinc-800 shadow-sm"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handlePlay(episode)}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-accent hover:bg-accent hover:text-zinc-950 transition-colors"
                      >
                        {isPlayingThis ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                      </button>
                      {episode.duration && (
                        <span className="text-[13px] font-medium text-accent">{formatDuration(episode.duration)}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center">
                      {downloadProgress[episode.id] !== undefined ? (
                        <div className="relative w-8 h-8 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-zinc-800"
                              strokeWidth="3"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-accent transition-all duration-300 ease-out"
                              strokeDasharray={`${downloadProgress[episode.id]}, 100`}
                              strokeWidth="3"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <span className="absolute text-[8px] font-mono font-medium text-accent">
                            {downloadProgress[episode.id]}%
                          </span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleDownload(episode, isDownloaded)}
                          className={clsx(
                            "p-2 rounded-full transition-colors",
                            isDownloaded 
                              ? "text-accent bg-accent/10" 
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
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
              <div className="flex justify-center pt-6 pb-4">
                <button
                  onClick={() => setVisibleCount(prev => prev + 50)}
                  className="px-6 py-2 rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-sm font-medium"
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
