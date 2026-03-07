import { useStore } from '../store';
import { Play, Pause, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { deleteDownloadedEpisode } from '../services/downloader';

export function Downloads() {
  const { downloads, currentEpisode, isPlaying, setIsPlaying, setCurrentEpisode } = useStore();

  const handlePlay = (episode: any) => {
    if (currentEpisode?.id === episode.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentEpisode(episode);
      setIsPlaying(true);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Tamanho desconhecido';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Downloads</h1>
      </div>

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">💾</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Sem Downloads</h2>
          <p className="text-zinc-500 text-sm max-w-xs">
            Episódios que você baixar para ouvir offline aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map((episode) => {
            const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
            
            return (
              <div key={episode.id} className="group flex gap-4 p-4 rounded-xl bg-zinc-900/30 hover:bg-zinc-900/80 transition-colors border border-zinc-800/50">
                <img 
                  src={episode.episodeArtwork || episode.podcastArtwork} 
                  alt={episode.podcastName} 
                  className="w-16 h-16 rounded-lg object-cover shadow-md"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className={clsx(
                    "font-semibold text-sm leading-tight mb-1 truncate",
                    currentEpisode?.id === episode.id ? "text-accent" : "text-zinc-100"
                  )}>
                    {episode.title}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate mb-2">{episode.podcastName}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    <span>{formatSize(episode.size)}</span>
                    <span>•</span>
                    <span>{format(new Date(episode.downloadedAt), "d 'de' MMM.", { locale: ptBR })}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handlePlay(episode)}
                    className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 hover:bg-accent hover:text-zinc-950 transition-colors"
                  >
                    {isPlayingThis ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                  </button>
                  <button 
                    onClick={() => deleteDownloadedEpisode(episode.id, episode.audioUrl)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
