import { useEffect } from 'react';
import { useStore } from '../store';
import { Podcast, Episode } from '../types';
import { getPodcastFeed } from '../services/api';
import { downloadEpisode } from '../services/downloader';

interface HomeProps {
  onSelectPodcast: (podcast: Podcast) => void;
}

export function Home({ onSelectPodcast }: HomeProps) {
  const { 
    subscriptions, 
    podcastLastViewed, 
    podcastLatestEpisode, 
    setPodcastLatestEpisode,
    settings,
    downloads
  } = useStore();

  useEffect(() => {
    // Check for new episodes in the background
    const checkNewEpisodes = async () => {
      await Promise.all(subscriptions.map(async (podcast) => {
        try {
          const feed = await getPodcastFeed(podcast.feedUrl);
          if (feed.items && feed.items.length > 0) {
            const latestItem = feed.items[0];
            const latestDate = latestItem.pubDate ? new Date(latestItem.pubDate).getTime() : 0;
            
            if (!isNaN(latestDate) && latestDate > 0) {
              const prevLatest = podcastLatestEpisode[podcast.collectionId] || 0;
              setPodcastLatestEpisode(podcast.collectionId, latestDate);

              // Auto-download logic
              if (settings.autoDownload && latestDate > prevLatest) {
                const isDownloaded = downloads.some(d => d.audioUrl === latestItem.enclosure?.url);
                if (!isDownloaded) {
                  // Map feed item to Episode type
                  const episode: Episode = {
                    id: latestItem.guid || latestItem.link || latestItem.title,
                    title: latestItem.title,
                    pubDate: latestItem.pubDate,
                    description: latestItem.contentSnippet || latestItem.content || latestItem['itunes:summary'] || '',
                    audioUrl: latestItem.enclosure?.url || '',
                    duration: latestItem['itunes:duration'],
                    podcastId: podcast.collectionId,
                    podcastName: podcast.collectionName,
                    podcastArtwork: podcast.artworkUrl600,
                    episodeArtwork: latestItem['itunes:image']?.$.href || latestItem['itunes:image'] || latestItem.itunes?.image || podcast.artworkUrl600
                  };
                  
                  if (episode.audioUrl) {
                    console.log(`Auto-downloading: ${episode.title}`);
                    downloadEpisode(episode).catch(err => console.error('Auto-download failed', err));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Failed to check new episodes for ${podcast.collectionName}`, error);
        }
      }));
    };

    checkNewEpisodes();
  }, [subscriptions, setPodcastLatestEpisode, settings.autoDownload, downloads]);

  return (
    <div className="p-4 pb-24 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pt-safe pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Biblioteca</h1>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
            <span className="text-4xl filter drop-shadow-lg">🎧</span>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">Nenhuma Inscrição</h2>
          <p className="text-zinc-400 text-base max-w-sm leading-relaxed">
            Pesquise por seus podcasts favoritos na aba Descobrir e inscreva-se para acompanhá-los aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {subscriptions.map((podcast) => {
            const lastViewed = podcastLastViewed[podcast.collectionId] || 0;
            const latestEpisode = podcastLatestEpisode[podcast.collectionId] || 0;
            const hasNewEpisode = latestEpisode > lastViewed;

            return (
              <button
                key={podcast.collectionId}
                onClick={() => onSelectPodcast(podcast)}
                className="text-left group flex flex-col relative"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 mb-2 shadow-lg shadow-black/40">
                  <img
                    src={podcast.artworkUrl600}
                    alt={podcast.collectionName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  {hasNewEpisode && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-accent text-zinc-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                      <div className="w-1.5 h-1.5 bg-zinc-950 rounded-full" />
                      NOVO
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-accent transition-colors">
                  {podcast.collectionName}
                </h3>
                <p className="text-xs text-zinc-500 truncate mt-1">{podcast.artistName}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
