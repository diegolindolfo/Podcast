export interface Podcast {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600: string;
  feedUrl: string;
}

export interface Episode {
  id: string;
  title: string;
  pubDate: string;
  description: string;
  audioUrl: string;
  duration?: string;
  podcastId: number;
  podcastName: string;
  podcastArtwork: string;
  episodeArtwork?: string;
}

export interface DownloadedEpisode extends Episode {
  downloadedAt: number;
  size?: number;
}
