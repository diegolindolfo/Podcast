import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, ChevronDown, Clock, FastForward, 
  ListMusic, Trash2, FileText, Video, Eye, EyeOff, PictureInPicture2 
} from 'lucide-react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { getCachedAudioUrl } from '../services/downloader';
import { splitTextWithTimestamps } from '../utils';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export function Player() {
  const { 
    currentEpisode, 
    setCurrentEpisode,
    isPlaying, 
    setIsPlaying, 
    progress, 
    setProgress, 
    duration, 
    setDuration, 
    playbackRate, 
    setPlaybackRate,
    volume,
    savedProgress,
    saveEpisodeProgress,
    sleepTimer,
    setSleepTimer,
    addToHistory,
    queue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    playNext,
    settings
  } = useStore(useShallow((s) => ({
    currentEpisode: s.currentEpisode,
    setCurrentEpisode: s.setCurrentEpisode,
    isPlaying: s.isPlaying,
    setIsPlaying: s.setIsPlaying,
    progress: s.progress,
    setProgress: s.setProgress,
    duration: s.duration,
    setDuration: s.setDuration,
    playbackRate: s.playbackRate,
    setPlaybackRate: s.setPlaybackRate,
    volume: s.volume,
    savedProgress: s.savedProgress,
    saveEpisodeProgress: s.saveEpisodeProgress,
    sleepTimer: s.sleepTimer,
    setSleepTimer: s.setSleepTimer,
    addToHistory: s.addToHistory,
    queue: s.queue,
    removeFromQueue: s.removeFromQueue,
    reorderQueue: s.reorderQueue,
    clearQueue: s.clearQueue,
    playNext: s.playNext,
    settings: s.settings,
  })));
  
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isVideoHidden, setIsVideoHidden] = useState(false);
  const lastSavedTime = useRef<number>(0);
  const hasRestoredProgress = useRef<boolean>(false);

  const isVideoEpisode = currentEpisode?.mediaType === 'video';

  // Media Session API for Android / OS media controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentEpisode) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentEpisode.title,
        artist: currentEpisode.podcastName,
        album: currentEpisode.podcastName,
        artwork: [
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '96x96' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '128x128' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '192x192' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '256x256' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '384x384' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '512x512' },
        ]
      });

      const skipTime = (amount: number) => {
        if (mediaRef.current) {
          mediaRef.current.currentTime = Math.max(0, Math.min(mediaRef.current.currentTime + amount, mediaRef.current.duration));
          updatePositionState();
        }
      };

      const skipBackwardVal = settings.skipBackward || 15;
      const skipForwardVal = settings.skipForward || 30;

      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('seekbackward', (details) => skipTime(-(details.seekOffset || skipBackwardVal)));
      navigator.mediaSession.setActionHandler('seekforward', (details) => skipTime(details.seekOffset || skipForwardVal));
      navigator.mediaSession.setActionHandler('previoustrack', () => skipTime(-skipBackwardVal));
      navigator.mediaSession.setActionHandler('nexttrack', () => skipTime(skipForwardVal));

      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && mediaRef.current) {
            mediaRef.current.currentTime = details.seekTime;
            updatePositionState();
          }
        });
      } catch (e) {
        console.warn('MediaSession seekto not supported');
      }
    }
  }, [currentEpisode, setIsPlaying, settings.skipBackward, settings.skipForward]);

  const updatePositionState = () => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && mediaRef.current) {
      const { duration, playbackRate, currentTime } = mediaRef.current;
      if (!isNaN(duration) && isFinite(duration) && !isNaN(currentTime)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: playbackRate,
            position: currentTime,
          });
        } catch (e) {
          console.error('Error updating position state', e);
        }
      }
    }
  };

  // Sleep timer logic with volume fade-out
  useEffect(() => {
    if (!sleepTimer || !isPlaying) {
      if (mediaRef.current) {
        mediaRef.current.volume = volume;
      }
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      if (now >= sleepTimer) {
        setIsPlaying(false);
        setSleepTimer(null);
        if (mediaRef.current) {
          mediaRef.current.volume = volume;
        }
      } else if (now >= sleepTimer - 30000 && mediaRef.current) {
        const remaining = sleepTimer - now;
        const ratio = Math.max(0, remaining / 30000);
        mediaRef.current.volume = volume * ratio;
      } else if (mediaRef.current) {
        mediaRef.current.volume = volume;
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (mediaRef.current) {
        mediaRef.current.volume = volume;
      }
    };
  }, [sleepTimer, isPlaying, volume, setIsPlaying, setSleepTimer]);

  useEffect(() => {
    let isSubscribed = true;
    hasRestoredProgress.current = false;
    setIsVideoHidden(false);

    if (currentEpisode) {
      getCachedAudioUrl(currentEpisode.audioUrl).then(url => {
        if (isSubscribed) {
          setAudioSrc(url || currentEpisode.audioUrl);
        }
      });
    } else {
      setAudioSrc(null);
    }

    return () => {
      isSubscribed = false;
      if (audioSrc && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [currentEpisode]);

  useEffect(() => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.play().catch(console.error);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
        if (currentEpisode) {
          addToHistory(currentEpisode);
        }
      } else {
        mediaRef.current.pause();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      }
    }
  }, [isPlaying, audioSrc, currentEpisode, addToHistory]);

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = playbackRate;
      mediaRef.current.volume = volume;
    }
  }, [playbackRate, volume]);

  const handleTimeUpdate = () => {
    if (mediaRef.current && currentEpisode) {
      const currentTime = mediaRef.current.currentTime;
      setProgress(currentTime);
      
      if (Math.abs(currentTime - lastSavedTime.current) > 5) {
        saveEpisodeProgress(currentEpisode.id, currentTime);
        lastSavedTime.current = currentTime;
        updatePositionState();
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current && currentEpisode) {
      setDuration(mediaRef.current.duration);
      updatePositionState();
      
      if (!hasRestoredProgress.current && savedProgress[currentEpisode.id]) {
        const savedTime = savedProgress[currentEpisode.id];
        if (savedTime < mediaRef.current.duration - 10) {
          mediaRef.current.currentTime = savedTime;
          setProgress(savedTime);
        }
        hasRestoredProgress.current = true;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const skip = (amount: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime += amount;
    }
  };

  const togglePiP = async () => {
    if (!mediaRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (mediaRef.current.requestPictureInPicture) {
        await mediaRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const mins = Math.floor((time % 3600) / 60);
    const secs = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSetTimer = (minutes: number | null) => {
    if (minutes === null) {
      setSleepTimer(null);
    } else {
      setSleepTimer(Date.now() + minutes * 60 * 1000);
    }
    setShowTimerMenu(false);
  };

  const getTimerRemaining = () => {
    if (!sleepTimer) return null;
    const remaining = Math.max(0, Math.ceil((sleepTimer - Date.now()) / 60000));
    return `${remaining}m`;
  };

  if (!currentEpisode) return null;

  return (
    <>
      {/* Elemento de reprodução (HTMLVideoElement toca tanto áudio MP3 quanto vídeo MP4) */}
      <video
        ref={mediaRef}
        src={audioSrc || undefined}
        preload="metadata"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={async () => {
          setIsPlaying(false);
          if (currentEpisode) {
            await saveEpisodeProgress(currentEpisode.id, 0);
            await useStore.getState().markEpisodeFinished(currentEpisode.id);
          }
          await playNext();
        }}
        className={clsx(
          "transition-opacity",
          isVideoEpisode && !isVideoHidden && isExpanded
            ? "w-full max-h-72 sm:max-h-80 rounded-2xl object-contain bg-black shadow-2xl mb-8 border border-white/10"
            : "hidden"
        )}
      />

      {/* Mini Player */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-0 right-0 bottom-16 h-16 bg-bg-surface/95 backdrop-blur-3xl border-t border-b border-white/10 shadow-[0_-10px_35px_rgba(0,0,0,0.4)] overflow-hidden z-40 cursor-pointer flex items-center px-6"
            onClick={() => setIsExpanded(true)}
          >
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
              <div 
                className="h-full bg-accent-main transition-all duration-300 ease-linear"
                style={{ width: `${(progress / (duration || 1)) * 100}%` }}
              />
            </div>
            
            <div className="relative mr-4 shrink-0">
              <img 
                src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
                alt="Artwork" 
                className="w-10 h-10 rounded-lg object-cover shadow-md"
                referrerPolicy="no-referrer"
              />
              {isVideoEpisode && (
                <div className="absolute -top-1 -right-1 bg-accent-main text-accent-text p-0.5 rounded shadow">
                  <Video size={10} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-text-main truncate uppercase tracking-tight">{currentEpisode.title}</h4>
              <p className="text-[9px] text-text-muted font-bold truncate uppercase tracking-widest leading-none mt-1">{currentEpisode.podcastName}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              className="w-10 h-10 rounded-full bg-accent-main text-accent-text flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Player */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            className="fixed inset-0 bg-bg-main flex flex-col p-6 z-50 pt-safe overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <button onClick={() => setIsExpanded(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-colors">
                <ChevronDown size={24} />
              </button>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Tocando Agora</span>
                {isVideoEpisode && (
                  <span className="inline-flex items-center gap-1 bg-accent-main/20 text-accent-main text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                    <Video size={10} />
                    Vídeo
                  </span>
                )}
              </div>

              {isVideoEpisode ? (
                <button 
                  onClick={togglePiP} 
                  title="Picture-in-Picture"
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-colors"
                >
                  <PictureInPicture2 size={20} />
                </button>
              ) : (
                <div className="w-12" />
              )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
              {/* Se for vídeo e não estiver oculto, o <video> acima já é renderizado na tela; se for áudio ou vídeo oculto, exibe a capa */}
              {(!isVideoEpisode || isVideoHidden) && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", damping: 15 }}
                  className="relative group mb-8"
                >
                  <img 
                    src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
                    alt="Artwork" 
                    className="w-72 h-72 sm:w-80 sm:h-80 rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.5)] object-cover border border-white/5"
                    referrerPolicy="no-referrer"
                  />
                  {isPlaying && (
                    <div className="absolute -bottom-4 -right-4 w-14 h-14 bg-accent-main rounded-full flex items-center justify-center shadow-2xl">
                      <div className="flex gap-1 items-end h-5">
                        <div className="w-1 h-3 bg-accent-text rounded-full" />
                        <div className="w-1 h-5 bg-accent-text rounded-full" />
                        <div className="w-1 h-4 bg-accent-text rounded-full" />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Botão de Alternar Vídeo / Apenas Áudio */}
              {isVideoEpisode && (
                <div className="mb-4">
                  <button
                    onClick={() => setIsVideoHidden(!isVideoHidden)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-text-muted hover:text-text-main text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    {isVideoHidden ? (
                      <>
                        <Eye size={12} />
                        Exibir Vídeo
                      </>
                    ) : (
                      <>
                        <EyeOff size={12} />
                        Apenas Áudio
                      </>
                    )}
                  </button>
                </div>
              )}
              
              <div className="text-center w-full mb-8 px-4">
                <h2 className="text-2xl sm:text-3xl font-black text-text-main mb-2 line-clamp-2 leading-tight tracking-tight">{currentEpisode.title}</h2>
                <p className="text-accent-main font-bold text-xs uppercase tracking-widest">{currentEpisode.podcastName}</p>
              </div>

              <div className="w-full mb-8 px-2">
                <div className="relative h-4 flex items-center mb-3">
                  <input 
                    type="range" 
                    min={0} 
                    max={duration || 100} 
                    value={progress} 
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent-main transition-all duration-150 ease-out"
                      style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] font-black tracking-widest text-text-muted uppercase">
                  <span className="bg-white/5 px-2 py-1 rounded-full">{formatTime(progress)}</span>
                  <span className="bg-black/40 text-text-muted px-2 py-1 rounded-full">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-8 w-full mb-8">
                <button onClick={() => skip(-(settings.skipBackward || 15))} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-all hover:scale-110 active:scale-90">
                  <SkipBack size={24} fill="currentColor" />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-20 h-20 flex items-center justify-center bg-accent-main text-accent-text rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                  {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={() => skip(settings.skipForward || 30)} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-all hover:scale-110 active:scale-90">
                  <SkipForward size={24} fill="currentColor" />
                </button>
              </div>

              <div className="flex items-center justify-between w-full px-2 mb-6 gap-2">
                <div className="relative">
                  <button 
                    onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowTimerMenu(false); }}
                    className={clsx(
                      "flex items-center gap-1.5 px-4 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                      playbackRate !== 1 ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted hover:text-text-main"
                    )}
                  >
                    <FastForward size={14} />
                    {playbackRate}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full left-0 mb-4 bg-bg-surface rounded-xl shadow-2xl overflow-hidden border border-white/5 min-w-[120px] backdrop-blur-xl z-30">
                      {[0.8, 1, 1.2, 1.5, 2, 2.5].map(rate => (
                        <button
                          key={rate}
                          onClick={() => { setPlaybackRate(rate); setShowSpeedMenu(false); }}
                          className={clsx(
                            "block w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors",
                            playbackRate === rate ? "text-accent-main" : "text-text-muted"
                          )}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button 
                    onClick={() => { setShowNotes(!showNotes); setShowQueue(false); setShowSpeedMenu(false); setShowTimerMenu(false); }}
                    className={clsx(
                      "flex items-center gap-1.5 px-4 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                      showNotes ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted hover:text-text-main"
                    )}
                  >
                    <FileText size={14} />
                    Notas
                  </button>
                </div>

                <div className="relative">
                  <button 
                    onClick={() => { setShowQueue(!showQueue); setShowNotes(false); setShowSpeedMenu(false); setShowTimerMenu(false); }}
                    className={clsx(
                      "flex items-center gap-1.5 px-4 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                      queue.length > 0 ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted hover:text-text-main"
                    )}
                  >
                    <ListMusic size={14} />
                    Fila {queue.length > 0 && `(${queue.length})`}
                  </button>
                </div>

                <div className="relative">
                  <button 
                    onClick={() => { setShowTimerMenu(!showTimerMenu); setShowSpeedMenu(false); }}
                    className={clsx(
                      "flex items-center gap-1.5 px-4 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                      sleepTimer ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted hover:text-text-main"
                    )}
                  >
                    <Clock size={14} />
                    {sleepTimer ? getTimerRemaining() : 'Timer'}
                  </button>
                  {showTimerMenu && (
                    <div className="absolute bottom-full right-0 mb-4 bg-bg-surface rounded-xl shadow-2xl overflow-hidden border border-white/5 min-w-[160px] backdrop-blur-xl z-30">
                      <button
                         onClick={() => handleSetTimer(null)}
                        className={clsx(
                          "block w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors",
                          !sleepTimer ? "text-accent-main" : "text-text-muted"
                        )}
                      >
                        Desligado
                      </button>
                      {[15, 30, 45, 60, 90].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleSetTimer(mins)}
                          className="block w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-white/5 transition-colors"
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fila Lateral / Bottom Drawer */}
            <AnimatePresence>
              {showQueue && (
                <motion.div 
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="fixed inset-x-0 bottom-0 top-20 bg-bg-surface/95 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 p-6 flex flex-col z-50 max-w-lg mx-auto"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ListMusic size={18} className="text-accent-main" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-text-main">Fila de Reprodução</h3>
                      <span className="text-[10px] font-bold text-text-muted">({queue.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {queue.length > 0 && (
                        <button
                          onClick={clearQueue}
                          className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10"
                        >
                          <Trash2 size={12} />
                          Limpar
                        </button>
                      )}
                      <button
                        onClick={() => setShowQueue(false)}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main"
                      >
                        <ChevronDown size={18} />
                      </button>
                    </div>
                  </div>

                  {queue.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-text-muted">
                      <ListMusic size={32} className="mb-2 opacity-50" />
                      <p className="text-xs font-semibold">Sua fila está vazia.</p>
                      <p className="text-[10px] opacity-70 mt-1">Toque no botão + em qualquer episódio para enfileirar.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5 -mx-2 px-2">
                      {queue.map((item, index) => (
                        <div key={item.id} className="py-3 flex items-center gap-3 group">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => reorderQueue(index, Math.max(0, index - 1))}
                              disabled={index === 0}
                              className="text-text-muted hover:text-text-main disabled:opacity-20 p-0.5"
                              title="Subir"
                            >
                              <ChevronDown size={14} className="rotate-180" />
                            </button>
                            <button
                              onClick={() => reorderQueue(index, Math.min(queue.length - 1, index + 1))}
                              disabled={index === queue.length - 1}
                              className="text-text-muted hover:text-text-main disabled:opacity-20 p-0.5"
                              title="Descer"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <img
                            src={item.episodeArtwork || item.podcastArtwork}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-bg-surface shrink-0"
                          />
                          <div
                            onClick={async () => {
                              removeFromQueue(item.id);
                              await setCurrentEpisode(item);
                              setIsPlaying(true);
                              setShowQueue(false);
                            }}
                            className="flex-1 min-w-0 cursor-pointer"
                          >
                            <h4 className="text-xs font-bold text-text-main truncate group-hover:text-accent-main transition-colors">
                              {item.title}
                            </h4>
                            <p className="text-[10px] text-text-muted truncate mt-0.5">
                              {item.podcastName}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            className="text-text-muted hover:text-red-400 p-2 transition-colors"
                            title="Remover da fila"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Show Notes Drawer com Timestamps Clicáveis */}
            <AnimatePresence>
              {showNotes && (
                <motion.div 
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="fixed inset-x-0 bottom-0 top-20 bg-bg-surface/95 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 p-6 flex flex-col z-50 max-w-lg mx-auto"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-accent-main" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-text-main">Notas do Episódio</h3>
                    </div>
                    <button
                      onClick={() => setShowNotes(false)}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main"
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto text-xs leading-relaxed text-text-muted space-y-3 pr-1">
                    <h4 className="text-sm font-bold text-text-main">{currentEpisode.title}</h4>
                    <div className="whitespace-pre-wrap font-sans">
                      {splitTextWithTimestamps(currentEpisode.description).map((seg, i) => {
                        if (seg.type === 'timestamp' && seg.seconds !== undefined) {
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                if (mediaRef.current) {
                                  mediaRef.current.currentTime = seg.seconds!;
                                  setProgress(seg.seconds!);
                                  setIsPlaying(true);
                                }
                              }}
                              className="inline-block px-1.5 py-0.5 mx-1 rounded bg-accent-main/20 text-accent-main font-bold text-[11px] hover:bg-accent-main hover:text-accent-text transition-colors"
                            >
                              {seg.value}
                            </button>
                          );
                        }
                        return <span key={i}>{seg.value}</span>;
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
