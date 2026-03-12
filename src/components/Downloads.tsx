import { useState } from 'react';
import { useStore } from '../store';
import { Play, Pause, Trash2, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { deleteDownloadedEpisode } from '../services/downloader';

export function Downloads() {
  const { downloads, currentEpisode, isPlaying, setIsPlaying, setCurrentEpisode } = useStore();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const handlePlay = async (episode: any) => {
    if (currentEpisode?.id === episode.id) {
      setIsPlaying(!isPlaying);
    } else {
      await setCurrentEpisode(episode);
      setIsPlaying(true);
    }
  };

  const handleDelete = async (episodeId: string, audioUrl: string) => {
    await deleteDownloadedEpisode(episodeId, audioUrl);
    setConfirmingDelete(null);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Tamanho desconhecido';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-[var(--color-accent-gradient)]">Downloads</h1>
      </div>

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
            <span className="text-4xl filter drop-shadow-lg">💾</span>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">Sem Downloads</h2>
          <p className="text-zinc-400 text-base max-w-sm leading-relaxed">
            Episódios que você baixar para ouvir offline aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map((episode) => {
            const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
            const isConfirming = confirmingDelete === episode.id;
            
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
                    <span>{(() => {
                      const date = new Date(episode.downloadedAt);
                      if (isNaN(date.getTime())) return 'Data Desconhecida';
                      return format(date, "d 'de' MMM.", { locale: ptBR });
                    })()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!isConfirming ? (
                    <>
                      <button 
                        onClick={() => handlePlay(episode)}
                        className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 hover:bg-[var(--color-accent-gradient)] hover:text-white transition-all"
                      >
                        {isPlayingThis ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                      </button>
                      <button 
                        onClick={() => setConfirmingDelete(episode.id)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1 bg-zinc-800 rounded-full p-1 border border-zinc-700">
                      <button 
                        onClick={() => handleDelete(episode.id, episode.audioUrl)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-400/20 transition-colors"
                        title="Confirmar exclusão"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => setConfirmingDelete(null)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-700 transition-colors"
                        title="Cancelar"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
