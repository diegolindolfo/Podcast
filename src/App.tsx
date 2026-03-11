import { useState, useEffect } from 'react';
import { Home } from './components/Home';
import { Search } from './components/Search';
import { Downloads } from './components/Downloads';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { BottomNav } from './components/BottomNav';
import { Player } from './components/Player';
import { PodcastDetail } from './components/PodcastDetail';
import { useStore } from './store';
import { Podcast } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const { loadSubscriptions, loadDownloads, loadSavedProgress, loadListenedPodcasts, loadPodcastTimestamps, loadCurrentEpisode, loadHistory, accentColor } = useStore();

  useEffect(() => {
    loadSubscriptions();
    loadDownloads();
    loadSavedProgress();
    loadListenedPodcasts();
    loadPodcastTimestamps();
    loadCurrentEpisode();
    loadHistory();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-accent', accentColor);
  }, [accentColor]);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    setSelectedPodcast(null);
  };

  const handleSelectPodcast = (podcast: Podcast) => {
    setSelectedPodcast(podcast);
  };

  const handleBack = () => {
    setSelectedPodcast(null);
  };

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100 font-sans selection:bg-accent/30">
      {selectedPodcast ? (
        <PodcastDetail podcast={selectedPodcast} onBack={handleBack} />
      ) : (
        <>
          {currentTab === 'home' && <Home onSelectPodcast={handleSelectPodcast} />}
          {currentTab === 'search' && <Search onSelectPodcast={handleSelectPodcast} />}
          {currentTab === 'downloads' && <Downloads />}
          {currentTab === 'history' && <History />}
          {currentTab === 'settings' && <Settings />}
        </>
      )}

      <Player />
      <BottomNav currentTab={currentTab} onChange={handleTabChange} />
    </div>
  );
}

