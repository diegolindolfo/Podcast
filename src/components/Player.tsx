import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Clock, FastForward, ListMusic, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { getCachedAudioUrl } from '../services/downloader';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export function Player() {
  const { 
    currentEpisode, 
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
    clearQueue,
    playNext,
    settings
  } = useStore();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const lastSavedTime = useRef<number>(0);
  const hasRestoredProgress = useRef<boolean>(false);

  // Media Session API for Android / OS media controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentEpisode) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentEpisode.title,
        artist: currentEpisode.podcastName,
        album: currentEpisode.podcastName,
        artwork: [
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '96x96', type: 'image/png' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '128x128', type: 'image/png' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '192x192', type: 'image/png' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '256x256', type: 'image/png' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '384x384', type: 'image/png' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '512x512', type: 'image/png' },
        ]
      });

      const skipTime = (amount: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + amount, audioRef.current.duration));
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
          if (details.seekTime !== undefined && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            updatePositionState();
          }
        });
      } catch (e) {
        console.warn('MediaSession seekto not supported');
      }
    }
  }, [currentEpisode, setIsPlaying, settings.skipBackward, settings.skipForward]);

  const updatePositionState = () => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && audioRef.current) {
      const { duration, playbackRate, currentTime } = audioRef.current;
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
      if (audioRef.current) {
        audioRef.current.volume = volume;
      }
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      if (now >= sleepTimer) {
        setIsPlaying(false);
        setSleepTimer(null);
        if (audioRef.current) {
          audioRef.current.volume = volume;
        }
      } else if (now >= sleepTimer - 30000 && audioRef.current) {
        // Fade out volume in the last 30 seconds
        const remaining = sleepTimer - now;
        const ratio = Math.max(0, remaining / 30000);
        audioRef.current.volume = volume * ratio;
      } else if (audioRef.current) {
        audioRef.current.volume = volume;
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.volume = volume;
      }
    };
  }, [sleepTimer, isPlaying, volume, setIsPlaying, setSleepTimer]);

  useEffect(() => {
    if (!currentEpisode) return;
    
    let active = true;
    hasRestoredProgress.current = false;
    
    const loadAudio = async () => {
      const cachedUrl = await getCachedAudioUrl(currentEpisode.audioUrl);
      if (active) {
        setAudioSrc(cachedUrl || currentEpisode.audioUrl);
      }
    };
    loadAudio();
    
    return () => {
      active = false;
    };
  }, [currentEpisode]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
        if (currentEpisode) {
          addToHistory(currentEpisode);
        }
      } else {
        audioRef.current.pause();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      }
    }
  }, [isPlaying, audioSrc, currentEpisode, addToHistory]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.volume = volume;
    }
  }, [playbackRate, volume]);

  const handleTimeUpdate = () => {
    if (audioRef.current && currentEpisode) {
      const currentTime = audioRef.current.currentTime;
      setProgress(currentTime);
      
      if (Math.abs(currentTime - lastSavedTime.current) > 5) {
        saveEpisodeProgress(currentEpisode.id, currentTime);
        lastSavedTime.current = currentTime;
        updatePositionState();
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && currentEpisode) {
      setDuration(audioRef.current.duration);
      updatePositionState();
      
      if (!hasRestoredProgress.current && savedProgress[currentEpisode.id]) {
        const savedTime = savedProgress[currentEpisode.id];
        if (savedTime < audioRef.current.duration - 10) {
          audioRef.current.currentTime = savedTime;
          setProgress(savedTime);
        }
        hasRestoredProgress.current = true;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const skip = (amount: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += amount;
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
      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        preload="metadata"
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
            
            <img 
              src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
              alt="Artwork" 
              className="w-10 h-10 rounded-lg object-cover mr-4 shadow-md"
              referrerPolicy="no-referrer"
            />
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
            className="fixed inset-0 bg-bg-main flex flex-col p-6 z-50 pt-safe"
          >
            <div className="flex justify-between items-center mb-8">
                <button onClick={() => setIsExpanded(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-colors">
                  <ChevronDown size={24} />
                </button>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Tocando Agora</span>
                <div className="w-12" />
              </div>

              <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", damping: 15 }}
                  className="relative group"
                >
                  <img 
                    src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
                    alt="Artwork" 
                    className="w-72 h-72 sm:w-80 sm:h-80 rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.5)] object-cover mb-12 border border-white/5"
                    referrerPolicy="no-referrer"
                  />
                  {isPlaying && (
                    <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-accent-main rounded-full flex items-center justify-center shadow-2xl">
                      <div className="flex gap-1 items-end h-5">
                        <div className="w-1 h-3 bg-accent-text rounded-full" />
                        <div className="w-1 h-5 bg-accent-text rounded-full" />
                        <div className="w-1 h-4 bg-accent-text rounded-full" />
                      </div>
                    </div>
                  )}
                </motion.div>
                
                <div className="text-center w-full mb-12 px-4">
                  <h2 className="text-3xl font-black text-text-main mb-3 line-clamp-2 leading-tight tracking-tight">{currentEpisode.title}</h2>
                  <p className="text-accent-main font-bold text-sm uppercase tracking-widest">{currentEpisode.podcastName}</p>
                </div>

                <div className="w-full mb-12 px-2">
                  <div className="relative h-4 flex items-center mb-4">
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

                <div className="flex items-center justify-center space-x-8 w-full mb-12">
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

                <div className="flex items-center justify-between w-full px-4 mb-8">
                  <div className="relative">
                    <button 
                      onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowTimerMenu(false); }}
                      className={clsx(
                        "flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                        playbackRate !== 1 ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted hover:text-text-main"
                      )}
                    >
                      <FastForward size={14} />
                      {playbackRate}x
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full left-0 mb-4 bg-bg-surface rounded-xl shadow-2xl overflow-hidden border border-white/5 min-w-[120px] backdrop-blur-xl">
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
                      onClick={() => { setShowQueue(!showQueue); setShowSpeedMenu(false); setShowTimerMenu(false); }}
                      className={clsx(
                        "flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
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
                        "flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                        sleepTimer ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted hover:text-text-main"
                      )}
                    >
                      <Clock size={14} />
                      {sleepTimer ? getTimerRemaining() : 'Timer'}
                    </button>
                    {showTimerMenu && (
                      <div className="absolute bottom-full right-0 mb-4 bg-bg-surface rounded-xl shadow-2xl overflow-hidden border border-white/5 min-w-[160px] backdrop-blur-xl">
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

                {/* Queue Overlay Drawer */}
                <AnimatePresence>
                  {showQueue && (
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="absolute inset-x-0 bottom-0 top-20 bg-bg-surface/95 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 z-30 flex flex-col p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-text-main">Fila de Reprodução ({queue.length})</h3>
                        <div className="flex gap-4">
                          {queue.length > 0 && (
                            <button 
                              onClick={() => clearQueue()}
                              className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest"
                            >
                              Limpar
                            </button>
                          )}
                          <button 
                            onClick={() => setShowQueue(false)} 
                            className="text-xs font-bold text-text-muted hover:text-text-main uppercase tracking-widest"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                        {queue.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm gap-2">
                            <ListMusic size={32} className="opacity-40" />
                            <p className="font-semibold uppercase tracking-wider text-[10px]">A fila está vazia</p>
                          </div>
                        ) : (
                          queue.map((ep, idx) => (
                            <div key={ep.id + '-' + idx} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 group">
                              <img 
                                src={ep.episodeArtwork || ep.podcastArtwork} 
                                alt={ep.title} 
                                className="w-10 h-10 rounded-lg object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-semibold text-text-main truncate">{ep.title}</h4>
                                <p className="text-[10px] text-text-muted truncate mt-0.5 uppercase tracking-wider font-bold">{ep.podcastName}</p>
                              </div>
                              <button 
                                onClick={() => removeFromQueue(ep.id)}
                                className="text-text-muted hover:text-red-500 p-2 transition-colors opacity-80 group-hover:opacity-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </>
  );
}
