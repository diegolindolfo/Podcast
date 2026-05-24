import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Clock, FastForward } from 'lucide-react';
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
    addToHistory
  } = useStore();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
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

      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('seekbackward', (details) => skipTime(-(details.seekOffset || 15)));
      navigator.mediaSession.setActionHandler('seekforward', (details) => skipTime(details.seekOffset || 30));
      navigator.mediaSession.setActionHandler('previoustrack', () => skipTime(-15));
      navigator.mediaSession.setActionHandler('nexttrack', () => skipTime(30));

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
  }, [currentEpisode, setIsPlaying]);

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

  // Sleep timer logic
  useEffect(() => {
    if (!sleepTimer || !isPlaying) return;

    const interval = setInterval(() => {
      if (Date.now() >= sleepTimer) {
        setIsPlaying(false);
        setSleepTimer(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimer, isPlaying, setIsPlaying, setSleepTimer]);

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
        onEnded={() => {
          setIsPlaying(false);
          if (currentEpisode) {
            saveEpisodeProgress(currentEpisode.id, 0);
            useStore.getState().markEpisodeFinished(currentEpisode.id);
          }
        }}
      />

      {/* Mini Player */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-4 right-4 bottom-24 h-18 bg-black/80 backdrop-blur-3xl rounded-xl border border-white/5 shadow-2xl overflow-hidden z-40 cursor-pointer flex items-center px-5"
            onClick={() => setIsExpanded(true)}
          >
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
              <div 
                className="h-full bg-accent-lime transition-all duration-300 ease-linear"
                style={{ width: `${(progress / (duration || 1)) * 100}%` }}
              />
            </div>
            
            <img 
              src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
              alt="Artwork" 
              className="w-12 h-12 rounded-lg object-cover mr-4 shadow-lg"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-text-main truncate uppercase tracking-tight">{currentEpisode.title}</h4>
              <p className="text-[10px] text-text-muted font-bold truncate uppercase tracking-widest leading-none mt-1">{currentEpisode.podcastName}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              className="w-10 h-10 rounded-full bg-accent-lime text-black flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
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
                    <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-accent-lime rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                      <div className="flex gap-1 items-end h-6">
                        <div className="w-1.5 h-3 bg-black rounded-full" />
                        <div className="w-1.5 h-6 bg-black rounded-full" />
                        <div className="w-1.5 h-4 bg-black rounded-full" />
                      </div>
                    </div>
                  )}
                </motion.div>
                
                <div className="text-center w-full mb-12 px-4">
                  <h2 className="text-3xl font-black text-text-main mb-3 line-clamp-2 leading-tight tracking-tight">{currentEpisode.title}</h2>
                  <p className="text-accent-lime font-bold text-sm uppercase tracking-widest">{currentEpisode.podcastName}</p>
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
                        className="h-full bg-accent-lime transition-all duration-150 ease-out"
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
                  <button onClick={() => skip(-15)} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-all hover:scale-110 active:scale-90">
                    <SkipBack size={24} fill="currentColor" />
                  </button>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-24 h-24 flex items-center justify-center bg-accent-lime text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(217,249,157,0.3)]"
                  >
                    {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1.5" />}
                  </button>
                  <button onClick={() => skip(30)} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-all hover:scale-110 active:scale-90">
                    <SkipForward size={24} fill="currentColor" />
                  </button>
                </div>

                <div className="flex items-center justify-between w-full px-4 mb-8">
                  <div className="relative">
                    <button 
                      onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowTimerMenu(false); }}
                      className={clsx(
                        "flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                        playbackRate !== 1 ? "bg-accent-lime text-black" : "bg-white/5 text-text-muted hover:text-text-main"
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
                              playbackRate === rate ? "text-accent-lime" : "text-text-muted"
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
                      onClick={() => { setShowTimerMenu(!showTimerMenu); setShowSpeedMenu(false); }}
                      className={clsx(
                        "flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                        sleepTimer ? "bg-accent-lime text-black" : "bg-white/5 text-text-muted hover:text-text-main"
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
                            !sleepTimer ? "text-accent-lime" : "text-text-muted"
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
            </motion.div>
          )}
        </AnimatePresence>
    </>
  );
}
