import { useState } from 'react';
import { useStore } from '../store';
import { Play, Pause, Trash2, History as HistoryIcon, X, Check } from 'lucide-react';
import { clsx } from 'clsx';

export function History() {
  const { history, currentEpisode, isPlaying, setIsPlaying, setCurrentEpisode, clearHistory } = useStore();
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePlay = async (episode: any) => {
    if (currentEpisode?.id === episode.id) {
      setIsPlaying(!isPlaying);
    } else {
      await setCurrentEpisode(episode);
      setIsPlaying(true);
    }
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pt-safe pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-[var(--color-accent-gradient)]">Histórico</h1>
          <p className="text-zinc-500 text-sm mt-1">Episódios ouvidos recentemente</p>
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-2">
            {showConfirm ? (
              <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-white/5 animate-in fade-in zoom-in duration-200">
                <button 
                  onClick={() => {
                    clearHistory();
                    setShowConfirm(false);
                  }}
                  className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                  title="Confirmar"
                >
                  <Check size={16} />
                </button>
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="p-1.5 text-zinc-500 hover:bg-zinc-800 rounded-md transition-colors"
                  title="Cancelar"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-xs font-medium border border-white/5"
              >
                <Trash2 size={14} />
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
            <HistoryIcon size={40} className="text-zinc-700" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">Histórico Vazio</h2>
          <p className="text-zinc-400 text-base max-w-sm leading-relaxed">
            Os episódios que você ouvir aparecerão aqui para fácil acesso.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((episode) => {
            const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
            
            return (
              <div key={episode.id} className="group flex gap-4 p-3 rounded-xl bg-zinc-900/30 hover:bg-zinc-900/80 transition-colors border border-zinc-800/50">
                <img 
                  src={episode.episodeArtwork || episode.podcastArtwork} 
                  alt={episode.podcastName} 
                  className="w-14 h-14 rounded-lg object-cover shadow-md"
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
                  <p className="text-xs text-zinc-400 truncate">{episode.podcastName}</p>
                </div>
                
                <div className="flex items-center">
                  <button 
                    onClick={() => handlePlay(episode)}
                    className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 hover:bg-[var(--color-accent-gradient)] hover:text-white transition-all"
                  >
                    {isPlayingThis ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
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
