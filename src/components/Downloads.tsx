import { useState } from 'react';
import { useStore } from '../store';
import { Play, Pause, Trash2, Check, X } from 'lucide-react';
import { DownloadsIcon } from './CustomIcons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { deleteDownloadedEpisode } from '../services/downloader';

import { motion, AnimatePresence } from 'motion/react';

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
    <div className="p-4 pb-24 min-h-screen bg-bg-main">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text-main">Downloads</h1>
        <p className="text-text-muted text-sm mt-1">Episódios salvos offline</p>
      </div>

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <div className="w-24 h-24 bg-bg-surface rounded-full flex items-center justify-center mb-6 border border-border-subtle shadow-2xl">
            <DownloadsIcon size={60} className="text-text-muted opacity-50" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-text-main">Sem Downloads</h2>
          <p className="text-text-muted text-base max-w-sm leading-relaxed">
            Episódios que você baixar para ouvir offline aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {downloads.map((episode, index) => {
              const isPlayingThis = currentEpisode?.id === episode.id && isPlaying;
              const isConfirming = confirmingDelete === episode.id;
              
              return (
                <motion.div 
                  key={episode.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex gap-4 p-4 rounded-xl bg-bg-surface hover:bg-bg-surface-hover transition-all border border-white/5 shadow-lg"
                >
                  <div className="relative flex-shrink-0 w-20 h-20">
                    <img 
                      src={episode.episodeArtwork || episode.podcastArtwork} 
                      alt={episode.podcastName} 
                      className="w-full h-full rounded-lg object-cover shadow-xl"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-accent-main/20 flex items-center justify-center rounded-lg backdrop-blur-[2px]">
                        <div className="flex gap-1 items-end h-5">
                          <div className="w-1 bg-accent-main animate-[music-bar_0.6s_ease-in-out_infinite]" />
                          <div className="w-1 bg-accent-main animate-[music-bar_0.8s_ease-in-out_infinite]" />
                          <div className="w-1 bg-accent-main animate-[music-bar_0.7s_ease-in-out_infinite]" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className={clsx(
                      "font-bold text-sm leading-tight mb-1 truncate transition-colors",
                      currentEpisode?.id === episode.id ? "text-accent-main" : "text-text-main group-hover:text-accent-main"
                    )}>
                      {episode.title}
                    </h3>
                    <p className="text-xs text-text-muted font-bold truncate mb-2">{episode.podcastName}</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wide">
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
                          className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-text-muted hover:bg-accent-main hover:text-accent-text transition-all hover:scale-105 active:scale-95 shadow-lg border border-white/5"
                        >
                          {isPlayingThis ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                        </button>
                        <button 
                          onClick={() => setConfirmingDelete(episode.id)}
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all hover:scale-105 active:scale-95"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    ) : (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5 shadow-2xl"
                      >
                        <button 
                          onClick={() => handleDelete(episode.id, episode.audioUrl)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-colors"
                          title="Confirmar exclusão"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={() => setConfirmingDelete(null)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:bg-white/5 transition-colors"
                          title="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </motion.div>
                    )}
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
