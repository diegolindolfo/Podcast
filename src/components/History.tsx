import { useState } from 'react';
import { useStore } from '../store';
import { Play, Pause, Trash2, History as HistoryIcon, X, Check } from 'lucide-react';
import { clsx } from 'clsx';

import { motion, AnimatePresence } from 'motion/react';

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
    <div className="p-4 pb-24 min-h-screen bg-zinc-950">
      <div className="pt-safe pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-[var(--color-accent-gradient)]">Histórico</h1>
          <p className="text-zinc-500 text-sm mt-1">Episódios ouvidos recentemente</p>
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-2">
            {showConfirm ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className="flex items-center gap-1 bg-zinc-900 rounded-xl p-1 border border-white/10 shadow-xl"
              >
                <button 
                  onClick={() => {
                    clearHistory();
                    setShowConfirm(false);
                  }}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Confirmar"
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="p-2 text-zinc-500 hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Cancelar"
                >
                  <X size={18} />
                </button>
              </motion.div>
            ) : (
              <button 
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-xs font-bold border border-white/5 shadow-sm"
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
          <AnimatePresence initial={false}>
            {history.map((episode, index) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              
              return (
                <motion.div 
                  key={episode.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group flex gap-4 p-4 rounded-2xl bg-zinc-900/30 hover:bg-zinc-900/60 transition-all border border-white/5 shadow-sm"
                >
                  <div className="relative flex-shrink-0">
                    <img 
                      src={episode.episodeArtwork || episode.podcastArtwork} 
                      alt={episode.podcastName} 
                      className="w-14 h-14 rounded-xl object-cover shadow-lg border border-white/5"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-accent/20 flex items-center justify-center rounded-xl">
                        <div className="flex gap-0.5 items-end h-3">
                          <div className="w-0.5 bg-white animate-[music-bar_0.6s_ease-in-out_infinite]" />
                          <div className="w-0.5 bg-white animate-[music-bar_0.8s_ease-in-out_infinite]" />
                          <div className="w-0.5 bg-white animate-[music-bar_0.7s_ease-in-out_infinite]" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className={clsx(
                      "font-bold text-sm leading-tight mb-1 truncate group-hover:text-accent transition-colors",
                      currentEpisode?.id === episode.id ? "text-accent" : "text-zinc-100"
                    )}>
                      {episode.title}
                    </h3>
                    <p className="text-xs text-zinc-500 truncate font-medium">{episode.podcastName}</p>
                  </div>
                  
                  <div className="flex items-center">
                    <button 
                      onClick={() => handlePlay(episode)}
                      className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 hover:bg-[var(--color-accent-gradient)] hover:text-white transition-all shadow-lg border border-white/5"
                    >
                      {isPlayingThis ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
