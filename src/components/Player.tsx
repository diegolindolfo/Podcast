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
    setAccentColor
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
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '512x512', type: 'image/jpeg' },
          { src: currentEpisode.episodeArtwork || currentEpisode.podcastArtwork, sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 15;
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(audioRef.current.currentTime - skipTime, 0);
          updatePositionState();
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 30;
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(audioRef.current.currentTime + skipTime, audioRef.current.duration);
          updatePositionState();
        }
      });

      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            updatePositionState();
          }
        });
      } catch (e) {
        // seekto not supported
      }

      try {
        navigator.mediaSession.setActionHandler('stop', () => {
          setIsPlaying(false);
          if (audioRef.current) audioRef.current.currentTime = 0;
        });
      } catch (e) {
        // stop not supported
      }
    }
  }, [currentEpisode, setIsPlaying]);

  const updatePositionState = () => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && audioRef.current && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audioRef.current.duration,
          playbackRate: audioRef.current.playbackRate,
          position: audioRef.current.currentTime,
        });
      } catch (e) {
        console.error('Error updating position state', e);
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
      } else {
        audioRef.current.pause();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      }
    }
  }, [isPlaying, audioSrc]);

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
          if (currentEpisode) saveEpisodeProgress(currentEpisode.id, 0);
        }}
      />

      {/* Mini Player */}
      <div 
        className={clsx(
          "fixed left-0 right-0 z-50 transition-all duration-300 ease-in-out",
          isExpanded 
            ? "bottom-0 h-screen bg-zinc-950" 
            : "bottom-16 h-16 bg-zinc-900/90 backdrop-blur-xl border-t border-white/5"
        )}
      >
        {!isExpanded && (
          <div className="flex items-center h-full px-4 cursor-pointer relative" onClick={() => setIsExpanded(true)}>
            {/* Mini Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-zinc-800">
              <div 
                className="h-full bg-[var(--color-accent-gradient)] transition-all duration-300 ease-linear"
                style={{ width: `${(progress / (duration || 1)) * 100}%` }}
              />
            </div>
            
            <img 
              src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
              alt="Artwork" 
              className="w-10 h-10 rounded-md object-cover mr-3 shadow-md"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-zinc-100 truncate">{currentEpisode.title}</h4>
              <p className="text-xs text-zinc-400 truncate">{currentEpisode.podcastName}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              className="p-2 text-zinc-100 hover:text-accent transition-colors"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
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
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 100 || velocity.y > 500) {
                  setIsExpanded(false);
                }
              }}
              className="absolute inset-0 bg-zinc-950 flex flex-col p-6"
            >
              {/* Drag Handle */}
              <div className="w-full flex justify-center pt-2 pb-4">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
              </div>

              <div className="flex justify-between items-center mb-8 pt-safe">
                <button onClick={() => setIsExpanded(false)} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
                  <ChevronDown size={28} />
                </button>
                <span className="text-xs font-semibold tracking-widest uppercase text-zinc-500">Tocando Agora</span>
                <div className="w-10" /> {/* Spacer */}
              </div>

              <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
                <img 
                  src={currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
                  alt="Artwork" 
                  className="w-64 h-64 sm:w-80 sm:h-80 rounded-2xl shadow-2xl object-cover mb-8"
                />
                
                <div className="text-center w-full mb-8">
                  <h2 className="text-xl font-bold text-white mb-2 line-clamp-2">{currentEpisode.title}</h2>
                  <p className="text-zinc-400">{currentEpisode.podcastName}</p>
                </div>

                <div className="w-full mb-8">
                  <input 
                    type="range" 
                    min={0} 
                    max={duration || 100} 
                    value={progress} 
                    onChange={handleSeek}
                    className="w-full accent-accent h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-2 font-mono">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-8 w-full mb-12">
                  <button onClick={() => skip(-15)} className="text-zinc-400 hover:text-white transition-colors">
                    <SkipBack size={32} />
                  </button>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-20 h-20 flex items-center justify-center bg-[var(--color-accent-gradient)] text-white rounded-full hover:opacity-90 transition-opacity shadow-lg shadow-accent/20"
                  >
                    {isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
                  </button>
                  <button onClick={() => skip(30)} className="text-zinc-400 hover:text-white transition-colors">
                    <SkipForward size={32} />
                  </button>
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-between w-full px-4 relative">
                  {/* Speed Control */}
                  <div className="relative">
                    <button 
                      onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowTimerMenu(false); }}
                      className={clsx(
                        "flex items-center gap-1 text-sm font-medium transition-colors",
                        playbackRate !== 1 ? "text-accent" : "text-zinc-400 hover:text-white"
                      )}
                    >
                      <FastForward size={18} />
                      {playbackRate}x
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-zinc-800 rounded-lg shadow-xl overflow-hidden border border-zinc-700">
                        {[0.8, 1, 1.2, 1.5, 2].map(rate => (
                          <button
                            key={rate}
                            onClick={() => { setPlaybackRate(rate); setShowSpeedMenu(false); }}
                            className={clsx(
                              "block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors",
                              playbackRate === rate ? "text-accent font-bold" : "text-zinc-300"
                            )}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sleep Timer */}
                  <div className="relative">
                    <button 
                      onClick={() => { setShowTimerMenu(!showTimerMenu); setShowSpeedMenu(false); }}
                      className={clsx(
                        "flex items-center gap-1 text-sm font-medium transition-colors",
                        sleepTimer ? "text-accent" : "text-zinc-400 hover:text-white"
                      )}
                    >
                      <Clock size={18} />
                      {sleepTimer ? getTimerRemaining() : 'Timer'}
                    </button>
                    {showTimerMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-zinc-800 rounded-lg shadow-xl overflow-hidden border border-zinc-700 min-w-[120px]">
                        <button
                          onClick={() => handleSetTimer(null)}
                          className={clsx(
                            "block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors",
                            !sleepTimer ? "text-accent font-bold" : "text-zinc-300"
                          )}
                        >
                          Desligado
                        </button>
                        {[15, 30, 45, 60].map(mins => (
                          <button
                            key={mins}
                            onClick={() => handleSetTimer(mins)}
                            className="block w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
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
      </div>
    </>
  );
}
