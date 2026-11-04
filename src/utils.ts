import { Episode, Podcast } from './types';

export function formatDuration(duration?: string | number): string {
  if (!duration) return '';
  
  // If it's already in HH:MM:SS format
  if (typeof duration === 'string' && duration.includes(':')) {
    const parts = duration.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes} min`;
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      return `${minutes} min`;
    }
    return duration;
  }

  // If it's a number (seconds)
  const seconds = typeof duration === 'string' ? parseInt(duration, 10) : duration;
  if (isNaN(seconds)) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

export function parseRssEpisode(item: any, podcast: Podcast): Episode {
  let episodeArtwork = podcast.artworkUrl600;
  if (item['itunes:image'] && typeof item['itunes:image'] === 'object' && item['itunes:image'].$) {
    episodeArtwork = item['itunes:image'].$.href;
  } else if (typeof item['itunes:image'] === 'string') {
    episodeArtwork = item['itunes:image'];
  } else if (item.itunes?.image) {
    episodeArtwork = item.itunes.image;
  }

  return {
    id: item.guid || item.link || item.title || `${podcast.collectionId}-${Date.now()}`,
    title: item.title || 'Sem título',
    pubDate: item.pubDate || new Date().toISOString(),
    description: item.contentSnippet || item.content || item['itunes:summary'] || item.summary || '',
    audioUrl: item.enclosure?.url || '',
    duration: item['itunes:duration'],
    podcastId: podcast.collectionId,
    podcastName: podcast.collectionName,
    podcastArtwork: podcast.artworkUrl600,
    episodeArtwork
  };
}
