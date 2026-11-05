import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, ChevronDown, Clock, 
  FastForward, ListMusic, Trash2, FileText, Bookmark, ExternalLink 
} from 'lucide-react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { getCachedAudioUrl } from '../services/downloader';
import { splitTextWithTimestamps } from '../utils';
import { fetchRemoteAudioChapters } from '../services/chapters';
import { Chapter } from '../types';
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
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [id3Chapters, setId3Chapters] = useState<Chapter[]>([]);
  const lastSavedTime = useRef<number>(0);
  const hasRestoredProgress = useRef<boolean>(false);

  // Combine chapters from episode description (RSS) and ID3 tags
  const chapters: Chapter[] = useMemo(() => {
    if (id3Chapters.length > 0) return id3Chapters;
    if (currentEpisode?.chapters && currentEpisode.chapters.length > 0) return currentEpisode.chapters;
    return [];
  }, [id3Chapters, currentEpisode?.chapters]);

  // Determine current active chapter based on playback progress
  const currentChapter = useMemo(() => {
    if (chapters.length === 0) return null;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (progress >= chapters[i].startTime) {
        return chapters[i];
      }
    }
    return chapters[0];
  }, [chapters, progress]);

  // Fetch ID3 chapters in background when currentEpisode changes
  useEffect(() => {
    let active = true;
    setId3Chapters([]);

    if (currentEpisode?.audioUrl) {
      // If feed already has chapters from description or JSON, we still check ID3 as fallback or complement
      fetchRemoteAudioChapters(currentEpisode.audioUrl).then((chaps) => {
        if (active && chaps.length > 0) {
          setId3Chapters(chaps);
        }
      });
    }

    return () => {
      active = false;
    };
  }, [currentEpisode?.id, currentEpisode?.audioUrl]);

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
    let isSubscribed = true;
    hasRestoredProgress.current = false;

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

  const seekToTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, duration || time));
      setProgress(audioRef.current.currentTime);
      setIsPlaying(true);
    }
  };

  const skipToPreviousChapter = () => {
    if (chapters.length === 0 || !audioRef.current) {
      skip(-(settings.skipBackward || 15));
      return;
    }

    const currTime = audioRef.current.currentTime;
    // If we're more than 3 seconds into current chapter, restart it
    if (currentChapter && currTime - currentChapter.startTime > 3) {
      seekToTime(currentChapter.startTime);
      return;
    }

    // Otherwise go to previous chapter
    const currIdx = currentChapter ? chapters.indexOf(currentChapter) : -1;
    if (currIdx > 0) {
      seekToTime(chapters[currIdx - 1].startTime);
    } else {
      seekToTime(0);
    }
  };

  const skipToNextChapter = () => {
    if (chapters.length === 0 || !audioRef.current) {
      skip(settings.skipForward || 30);
      return;
    }

    const currIdx = currentChapter ? chapters.indexOf(currentChapter) : -1;
    if (currIdx >= 0 && currIdx + 1 < chapters.length) {
      seekToTime(chapters[currIdx + 1].startTime);
    } else {
      skip(settings.skipForward || 30);
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
            className="fixed left-0 right-0 bottom-16 z-40 pointer-events-none"
          >
            <div
              onClick={() => setIsExpanded(true)}
              className="pointer-events-auto max-w-4xl mx-auto h-16 bg-bg-surface/95 backdrop-blur-3xl border-t border-b border-white/10 shadow-[0_-10px_35px_rgba(0,0,0,0.4)] overflow-hidden cursor-pointer flex items-center px-4 sm:px-6 relative"
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
                className="w-10 h-10 rounded-lg object-cover mr-3.5 shadow-md shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0 mr-2">
                <h4 className="text-xs font-bold text-text-main truncate uppercase tracking-tight">{currentEpisode.title}</h4>
                <p className="text-[9px] text-text-muted font-bold truncate uppercase tracking-widest leading-none mt-1">
                  {currentChapter ? `📍 ${currentChapter.title}` : currentEpisode.podcastName}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); skip(-(settings.skipBackward || 15)); }}
                  className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black text-text-muted hover:text-text-main transition-colors"
                  title={`Voltar ${settings.skipBackward || 15}s`}
                >
                  -{settings.skipBackward || 15}s
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
                  className="w-10 h-10 rounded-full bg-accent-main text-accent-text flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md"
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); skip(settings.skipForward || 30); }}
                  className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black text-text-muted hover:text-text-main transition-colors"
                  title={`Avançar ${settings.skipForward || 30}s`}
                >
                  +{settings.skipForward || 30}s
                </button>
              </div>
            </div>
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
            transition={{ type: "spring", damping: 25, stiffness: 260 }}
            className="fixed inset-0 bg-bg-main flex flex-col p-6 z-50 pt-safe overflow-y-auto"
          >
            {/* Ambient Glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
              <img
                src={currentChapter?.img || currentEpisode.episodeArtwork || currentEpisode.podcastArtwork}
                alt=""
                className="w-full h-full object-cover blur-3xl opacity-20 scale-125"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-bg-main/40 via-bg-main/80 to-bg-main" />
            </div>

            <div className="relative z-10 flex justify-between items-center mb-6 shrink-0 max-w-lg mx-auto w-full">
              <button onClick={() => setIsExpanded(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-colors">
                <ChevronDown size={24} />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Tocando Agora</span>
                {chapters.length > 0 && currentChapter && (
                  <span className="text-[9px] font-black uppercase text-accent-main tracking-wider mt-0.5">
                    Capítulo {chapters.indexOf(currentChapter) + 1} de {chapters.length}
                  </span>
                )}
              </div>
              <div className="w-12" />
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", damping: 15 }}
                className="relative group mb-8"
              >
                <img 
                  src={currentChapter?.img || currentEpisode.episodeArtwork || currentEpisode.podcastArtwork} 
                  alt="Artwork" 
                  className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.6)] object-cover border border-white/10"
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
              
              <div className="text-center w-full mb-6 px-4">
                <h2 className="text-2xl sm:text-3xl font-black text-text-main mb-2 line-clamp-2 leading-tight tracking-tight">{currentEpisode.title}</h2>
                <p className="text-accent-main font-bold text-xs uppercase tracking-widest">{currentEpisode.podcastName}</p>

                {/* Capítulo Atual em Destaque */}
                {currentChapter && (
                  <button
                    onClick={() => { setShowChapters(true); setShowNotes(false); setShowQueue(false); }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-main/10 border border-accent-main/20 text-accent-main text-xs font-bold max-w-full hover:bg-accent-main/20 transition-all"
                  >
                    <Bookmark size={12} className="shrink-0" />
                    <span className="truncate">{currentChapter.title}</span>
                  </button>
                )}
              </div>

              {/* Barra de Progresso com Marcadores de Capítulos e Thumb Visível */}
              <div className="w-full mb-8 px-2">
                <div className="relative h-6 flex items-center mb-2 group">
                  <input 
                    type="range" 
                    min={0} 
                    max={duration || 100} 
                    value={progress} 
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full bg-accent-main transition-all duration-150 ease-out"
                      style={{ width: `${Math.min(100, (progress / (duration || 1)) * 100)}%` }}
                    />
                    {/* Marcadores visuais de início de capítulo */}
                    {duration > 0 && chapters.map((chap, idx) => {
                      if (chap.startTime <= 0) return null;
                      const pct = (chap.startTime / duration) * 100;
                      if (pct >= 99) return null;
                      return (
                        <div
                          key={idx}
                          className="absolute top-0 bottom-0 w-0.5 bg-black/70 pointer-events-none"
                          style={{ left: `${pct}%` }}
                          title={chap.title}
                        />
                      );
                    })}
                  </div>
                  {/* Thumb interativo */}
                  <div
                    className="absolute w-4 h-4 rounded-full bg-accent-main shadow-lg ring-2 ring-white/30 pointer-events-none transition-transform group-hover:scale-125"
                    style={{ left: `calc(${Math.min(100, (progress / (duration || 1)) * 100)}% - 8px)` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black tracking-widest text-text-muted uppercase">
                  <span className="bg-white/5 px-2.5 py-1 rounded-full">{formatTime(progress)}</span>
                  <span className="bg-white/5 text-text-muted px-2.5 py-1 rounded-full">-{formatTime(Math.max(0, (duration || 0) - progress))}</span>
                </div>
              </div>

              {/* Controles de Reprodução */}
              <div className="flex items-center justify-center space-x-5 sm:space-x-6 w-full mb-8">
                {/* Pular para Capítulo Anterior */}
                <button 
                  onClick={skipToPreviousChapter} 
                  title={chapters.length > 0 ? "Capítulo anterior" : "Voltar 15s"}
                  className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-all hover:scale-110 active:scale-90"
                >
                  <SkipBack size={18} fill="currentColor" />
                </button>

                {/* Voltar X segundos */}
                <button 
                  onClick={() => skip(-(settings.skipBackward || 15))} 
                  className="text-[11px] font-black text-text-muted hover:text-text-main px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  title={`Voltar ${settings.skipBackward || 15}s`}
                >
                  -{settings.skipBackward || 15}s
                </button>

                {/* Play / Pause Principal */}
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-20 h-20 flex items-center justify-center bg-accent-main text-accent-text rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl shrink-0"
                >
                  {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                </button>

                {/* Avançar X segundos */}
                <button 
                  onClick={() => skip(settings.skipForward || 30)} 
                  className="text-[11px] font-black text-text-muted hover:text-text-main px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  title={`Avançar ${settings.skipForward || 30}s`}
                >
                  +{settings.skipForward || 30}s
                </button>

                {/* Pular para Próximo Capítulo */}
                <button 
                  onClick={skipToNextChapter} 
                  title={chapters.length > 0 ? "Próximo capítulo" : "Avançar 30s"}
                  className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main transition-all hover:scale-110 active:scale-90"
                >
                  <SkipForward size={18} fill="currentColor" />
                </button>
              </div>

              {/* Botões Auxiliares de Navegação (Flex Wrap Responsivo) */}
              <div className="flex flex-wrap items-center justify-center gap-2 w-full px-1 mb-6">
                {/* Velocidade */}
                <div className="relative">
                  <button 
                    onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowTimerMenu(false); }}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
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

                {/* Botão Capítulos */}
                {chapters.length > 0 && (
                  <div className="relative">
                    <button 
                      onClick={() => { setShowChapters(!showChapters); setShowNotes(false); setShowQueue(false); setShowSpeedMenu(false); setShowTimerMenu(false); }}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                        showChapters ? "bg-accent-main text-accent-text" : "bg-accent-main/15 text-accent-main hover:bg-accent-main/25"
                      )}
                    >
                      <Bookmark size={14} />
                      Capítulos ({chapters.length})
                    </button>
                  </div>
                )}

                {/* Notas / Descrição */}
                <div className="relative">
                  <button 
                    onClick={() => { setShowNotes(!showNotes); setShowChapters(false); setShowQueue(false); setShowSpeedMenu(false); setShowTimerMenu(false); }}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                      showNotes ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted hover:text-text-main"
                    )}
                  >
                    <FileText size={14} />
                    Notas
                  </button>
                </div>

                {/* Fila */}
                <div className="relative">
                  <button 
                    onClick={() => { setShowQueue(!showQueue); setShowChapters(false); setShowNotes(false); setShowSpeedMenu(false); setShowTimerMenu(false); }}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                      queue.length > 0 ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted hover:text-text-main"
                    )}
                  >
                    <ListMusic size={14} />
                    Fila {queue.length > 0 && `(${queue.length})`}
                  </button>
                </div>

                {/* Timer de Dormir */}
                <div className="relative">
                  <button 
                    onClick={() => { setShowTimerMenu(!showTimerMenu); setShowSpeedMenu(false); }}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
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

            {/* Gaveta de Capítulos */}
            <AnimatePresence>
              {showChapters && (
                <motion.div 
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="fixed inset-x-0 bottom-0 top-20 bg-bg-surface/95 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 p-6 flex flex-col z-50 max-w-lg mx-auto"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Bookmark size={18} className="text-accent-main" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-text-main">Capítulos do Episódio</h3>
                      <span className="text-[10px] font-bold text-text-muted">({chapters.length})</span>
                    </div>
                    <button
                      onClick={() => setShowChapters(false)}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main"
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-white/5 -mx-2 px-2">
                    {chapters.map((chap, idx) => {
                      const isCurrent = currentChapter === chap;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            seekToTime(chap.startTime);
                            setShowChapters(false);
                          }}
                          className={clsx(
                            "py-3.5 px-3 flex items-center gap-3.5 rounded-xl cursor-pointer transition-all",
                            isCurrent 
                              ? "bg-accent-main/15 border border-accent-main/20 text-text-main" 
                              : "hover:bg-white/5 text-text-muted hover:text-text-main"
                          )}
                        >
                          <span className={clsx(
                            "w-6 text-center text-[11px] font-black",
                            isCurrent ? "text-accent-main" : "text-text-muted"
                          )}>
                            {idx + 1}
                          </span>

                          <div className="flex-1 min-w-0">
                            <h4 className={clsx(
                              "text-xs font-bold truncate leading-snug",
                              isCurrent ? "text-accent-main font-black" : "text-text-main"
                            )}>
                              {chap.title}
                            </h4>
                            {chap.endTime && (
                              <span className="text-[10px] opacity-60">
                                Duração: {formatTime(chap.endTime - chap.startTime)}
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className={clsx(
                              "text-[10px] font-mono font-bold px-2 py-1 rounded",
                              isCurrent ? "bg-accent-main text-accent-text" : "bg-white/5 text-text-muted"
                            )}>
                              {formatTime(chap.startTime)}
                            </span>
                          </div>

                          {chap.url && (
                            <a
                              href={chap.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-text-muted hover:text-accent-main p-1"
                              title="Link do capítulo"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                                seekToTime(seg.seconds!);
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
