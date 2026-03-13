import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, ChevronUp, ChevronDown, Clock, FastForward } from 'lucide-react';
import { useStore } from '../store';
import { getCachedAudioUrl } from '../services/downloader';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { FastAverageColor } from 'fast-average-color';

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
    setAccentColor,
    addToHistory
  } = useStore();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const lastSavedTime = useRef<number>(0);
  const hasRestoredProgress = useRef<boolean>(false);

  // Extract accent color
  useEffect(() => {
    if (!currentEpisode) return;
    
    const imgUrl = currentEpisode.episodeArtwork || currentEpisode.podcastArtwork;
    if (!imgUrl) return;

    const fac = new FastAverageColor();
    
    // Create an image element to load the image with crossOrigin
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;
    
    img.onload = () => {
      try {
        const color = fac.getColor(img, { algorithm: 'dominant' });
        let [r, g, b] = color.value;
        
        // Calculate luminance to ensure it's readable on dark backgrounds
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        if (luminance < 0.6) {
          const factor = (0.6 - luminance) / (1 - luminance);
          r = r + (255 - r) * factor;
          g = g + (255 - g) * factor;
          b = b + (255 - b) * factor;
        }
        
        const toHex = (c: number) => {
          const hex = Math.round(c).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        
        setAccentColor(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
      } catch (e) {
        console.error('Failed to extract color', e);
        setAccentColor('#10b981'); // fallback
      }
    };
    
    img.onerror = () => {
      setAccentColor('#10b981'); // fallback
    };
    
    return () => {
      fac.destroy();
    };
  }, [currentEpisode, setAccentColor]);

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

      try {
        navigator.mediaSession.setActionHandler('stop', () => {
          setIsPlaying(false);
          if (audioRef.current) audioRef.current.currentTime = 0;
        });
      } catch (e) {
        console.warn('MediaSession stop not supported');
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
      if (audioSrc && audioSrc.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc);
      }
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
      
      // Save progress every 5 seconds
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
      
      // Restore saved progress
      if (!hasRestoredProgress.current && savedProgress[currentEpisode.id]) {
        const savedTime = savedProgress[currentEpisode.id];
        // Only restore if we haven't finished the episode (leave 10 seconds buffer)
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
      <div 
        className={clsx(
          "fixed left-0 right-0 z-50 transition-all duration-500 ease-in-out",
          isExpanded 
            ? "bottom-0 h-screen bg-zinc-950" 
            : "bottom-16 h-16 glass mx-2 mb-2 rounded-2xl border border-white/10 shadow-2xl"
        )}
      >
        {!isExpanded && (
          <div className="flex items-center h-full px-4 cursor-pointer relative" onClick={() => setIsExpanded(true)}>
            {/* Mini Progress Bar */}
            <div className="absolute top-0 left-4 right-4 h-[2px] bg-zinc-800/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-300 ease-linear shadow-[0_0_8px_rgba(var(--app-accent-rgb),0.5)]"
                style={{ width: `${(progress / (duration || 1)) * 100}%` }}
              />
            </div>
            
            <img 
              src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
              alt="Artwork" 
              className="w-10 h-10 rounded-lg object-cover mr-3 shadow-lg ring-1 ring-white/10"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-zinc-100 truncate tracking-tight">{currentEpisode.title}</h4>
              <p className="text-[10px] text-zinc-500 truncate uppercase font-semibold tracking-wider">{currentEpisode.podcastName}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              className="p-2 text-zinc-100 hover:text-accent transition-all active:scale-90"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
          </div>
        )}

        {/* Expanded Player */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 200 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 150 || velocity.y > 800) {
                  setIsExpanded(false);
                }
              }}
              className="absolute inset-0 bg-zinc-950 flex flex-col overflow-hidden"
            >
              {/* Dynamic Background */}
              <div className="absolute inset-0 z-0 opacity-40">
                <div 
                  className="absolute inset-0 blur-[120px] scale-150"
                  style={{ 
                    background: `radial-gradient(circle at 50% 30%, var(--app-accent) 0%, transparent 70%), 
                                 radial-gradient(circle at 10% 80%, #4f46e5 0%, transparent 50%)` 
                  }}
                />
                <div className="absolute inset-0 bg-zinc-950/60" />
              </div>

              <div className="relative z-10 flex flex-col h-full p-6">
                {/* Drag Handle */}
                <div className="w-full flex justify-center pt-2 pb-6">
                  <div className="w-12 h-1.5 bg-white/10 rounded-full" />
                </div>

                <div className="flex justify-between items-center mb-8 pt-safe">
                  <button onClick={() => setIsExpanded(false)} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors bg-white/5 rounded-full">
                    <ChevronDown size={24} />
                  </button>
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-500">Tocando Agora</span>
                  <div className="w-10" />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
                  <div className="relative group">
                    <img 
                      src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
                      alt="Artwork" 
                      className="w-72 h-72 sm:w-80 sm:h-80 rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] object-cover mb-10 transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute -inset-4 bg-accent/20 blur-3xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  </div>
                  
                  <div className="text-center w-full mb-10">
                    <h2 className="text-2xl font-black text-white mb-3 line-clamp-2 leading-tight tracking-tight">{currentEpisode.title}</h2>
                    <p className="text-zinc-400 font-serif italic text-lg">{currentEpisode.podcastName}</p>
                  </div>

                  <div className="w-full mb-10">
                    <div className="relative h-1.5 bg-white/10 rounded-full mb-3 group cursor-pointer">
                      <input 
                        type="range" 
                        min={0} 
                        max={duration || 100} 
                        value={progress} 
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div 
                        className="absolute top-0 left-0 h-full bg-accent rounded-full shadow-[0_0_15px_rgba(var(--app-accent-rgb),0.6)]"
                        style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-500 font-black tracking-tighter uppercase">
                      <span>{formatTime(progress)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center space-x-10 w-full mb-12">
                    <button onClick={() => skip(-15)} className="text-zinc-400 hover:text-white transition-all active:scale-90">
                      <SkipBack size={32} fill="currentColor" />
                    </button>
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-20 h-20 flex items-center justify-center bg-white text-zinc-950 rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.3)]"
                    >
                      {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1.5" />}
                    </button>
                    <button onClick={() => skip(30)} className="text-zinc-400 hover:text-white transition-all active:scale-90">
                      <SkipForward size={32} fill="currentColor" />
                    </button>
                  </div>

                  {/* Secondary Controls */}
                  <div className="flex items-center justify-between w-full px-4">
                    <div className="relative">
                      <button 
                        onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowTimerMenu(false); }}
                        className={clsx(
                          "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase transition-all",
                          playbackRate !== 1 ? "bg-accent text-zinc-950" : "bg-white/5 text-zinc-400 hover:text-white"
                        )}
                      >
                        <FastForward size={14} />
                        {playbackRate}x
                      </button>
                      {showSpeedMenu && (
                        <div className="absolute bottom-full left-0 mb-4 bg-zinc-900/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/10 min-w-[100px] animate-in fade-in slide-in-from-bottom-2">
                          {[0.8, 1, 1.2, 1.5, 2].map(rate => (
                            <button
                              key={rate}
                              onClick={() => { setPlaybackRate(rate); setShowSpeedMenu(false); }}
                              className={clsx(
                                "block w-full text-left px-5 py-3 text-xs font-bold hover:bg-white/10 transition-colors",
                                playbackRate === rate ? "text-accent" : "text-zinc-300"
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
                          "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase transition-all",
                          sleepTimer ? "bg-accent text-zinc-950" : "bg-white/5 text-zinc-400 hover:text-white"
                        )}
                      >
                        <Clock size={14} />
                        {sleepTimer ? getTimerRemaining() : 'Timer'}
                      </button>
                      {showTimerMenu && (
                        <div className="absolute bottom-full right-0 mb-4 bg-zinc-900/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/10 min-w-[140px] animate-in fade-in slide-in-from-bottom-2">
                          <button
                            onClick={() => handleSetTimer(null)}
                            className={clsx(
                              "block w-full text-left px-5 py-3 text-xs font-bold hover:bg-white/10 transition-colors",
                              !sleepTimer ? "text-accent" : "text-zinc-300"
                            )}
                          >
                            Desligado
                          </button>
                          {[15, 30, 45, 60].map(mins => (
                            <button
                              key={mins}
                              onClick={() => handleSetTimer(mins)}
                              className="block w-full text-left px-5 py-3 text-xs font-bold text-zinc-300 hover:bg-white/10 transition-colors"
                            >
                              {mins} min
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
