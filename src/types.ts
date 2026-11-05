export interface Podcast {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600: string;
  feedUrl: string;
  genreIds?: string[];
}

export interface Chapter {
  title: string;
  startTime: number; // in seconds
  endTime?: number;  // in seconds
  url?: string;
  img?: string;
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
  chapters?: Chapter[];
  chaptersUrl?: string; // Podcasting 2.0 JSON chapters URL
}

export interface DownloadedEpisode extends Episode {
  downloadedAt: number;
  size?: number;
}
