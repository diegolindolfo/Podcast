import { Episode, DownloadedEpisode } from '../types';
import { useStore } from '../store';

const CACHE_NAME = 'podcast-audio-cache-v1';
const IMAGE_CACHE_NAME = 'podcast-image-cache-v1';

// Deduplicates concurrent download requests for the same episode
const inFlightDownloads = new Map<string, Promise<void>>();

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
      } catch {
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
      if (response.type === 'opaque') {
        return imageUrl;
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (error) {
    console.error('Cache match failed for image:', error);
  }
  return imageUrl;
}

export function downloadEpisode(
  episode: Episode,
  onProgress?: (progress: number) => void
): Promise<void> {
  const existing = inFlightDownloads.get(episode.id);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    try {
      // Skip if already downloaded
      if (useStore.getState().downloads.some(d => d.id === episode.id)) {
        return;
      }

      const cache = await caches.open(CACHE_NAME);

      // Attempt direct download first, fallback to proxy for CORS-blocked CDNs
      let response: Response;
      try {
        response = await fetch(episode.audioUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (directErr) {
        console.warn('Download direto falhou (provável CORS), usando proxy de áudio...', directErr);
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(episode.audioUrl)}`;
        response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Falha ao baixar áudio tanto diretamente quanto via proxy');
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (total > 0 && onProgress && response.body) {
        const reader = response.body.getReader();
        let loaded = 0;

        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  break;
                }
                if (value) {
                  loaded += value.length;
                  onProgress(Math.round((loaded / total) * 100));
                  controller.enqueue(value);
                }
              }
            } catch (err) {
              controller.error(err);
            }
          }
        });

        const newResponse = new Response(stream, {
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
    } finally {
      inFlightDownloads.delete(episode.id);
    }
  })();

  inFlightDownloads.set(episode.id, task);
  return task;
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
      // Stream directly from the Service Worker cache (with HTTP Range support) when active,
      // avoiding loading the entire audio file into a main-thread Blob URL.
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        return `/__cached_audio__?url=${encodeURIComponent(audioUrl)}`;
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (error) {
    console.error('Cache match failed:', error);
  }
  return null;
}
