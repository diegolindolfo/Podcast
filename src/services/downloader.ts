import { Episode, DownloadedEpisode } from '../types';
import { useStore } from '../store';

const CACHE_NAME = 'podcast-audio-cache-v1';
const IMAGE_CACHE_NAME = 'podcast-image-cache-v1';

export async function downloadImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const match = await cache.match(imageUrl);
    if (!match) {
      try {
        const response = await fetch(imageUrl);
        if (response.ok) {
          await cache.put(imageUrl, response);
        }
      } catch (e) {
        // Fallback to no-cors if standard fetch fails due to CORS
        const response = await fetch(imageUrl, { mode: 'no-cors' });
        await cache.put(imageUrl, response);
      }
    }
  } catch (error) {
    console.error('Failed to download image:', error);
  }
}

export async function getCachedImageUrl(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const response = await cache.match(imageUrl);
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (error) {
    console.error('Cache match failed for image:', error);
  }
  return imageUrl;
}

export async function downloadEpisode(
  episode: Episode,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(episode.audioUrl);
    if (!response.ok) throw new Error('Failed to download audio');
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (total > 0 && onProgress && response.body) {
      const reader = response.body.getReader();
      let loaded = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          onProgress(Math.round((loaded / total) * 100));
        }
      }

      const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mpeg' });
      const newResponse = new Response(blob, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText
      });
      await cache.put(episode.audioUrl, newResponse);
    } else {
      await cache.put(episode.audioUrl, response.clone());
    }
    
    const size = total || 0;
    
    // Download the image as well
    if (episode.podcastArtwork) {
      await downloadImage(episode.podcastArtwork).catch(console.error);
    }
    
    const downloaded: DownloadedEpisode = {
      ...episode,
      downloadedAt: Date.now(),
      size
    };
    
    await useStore.getState().addDownload(downloaded);
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

export async function deleteDownloadedEpisode(episodeId: string, audioUrl: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(audioUrl);
    await useStore.getState().removeDownload(episodeId);
  } catch (error) {
    console.error('Delete failed:', error);
    throw error;
  }
}

export async function getCachedAudioUrl(audioUrl: string): Promise<string | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(audioUrl);
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (error) {
    console.error('Cache match failed:', error);
  }
  return null;
}
