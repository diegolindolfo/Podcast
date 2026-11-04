const AUDIO_CACHE_NAME = 'podcast-audio-cache-v1';

// Serve downloaded audio directly from Cache Storage (with Range support for seeking)
// so the page doesn't have to materialize an entire 100MB+ MP3 as an in-memory Blob.
self.addEventListener('fetch', function(event) {
  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin || reqUrl.pathname !== '/__cached_audio__') {
    return;
  }
  const targetUrl = reqUrl.searchParams.get('url');
  if (!targetUrl) return;

  event.respondWith((async () => {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cachedResponse = await cache.match(targetUrl);
    if (!cachedResponse) {
      return fetch(targetUrl);
    }

    const rangeHeader = event.request.headers.get('range');
    const contentType = cachedResponse.headers.get('content-type') || 'audio/mpeg';
    const blob = await cachedResponse.blob();
    const total = blob.size;

    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(total),
          'Accept-Ranges': 'bytes'
        }
      });
    }

    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10) || 0;
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), total - 1) : total - 1;
    if (start >= total || start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${total}` }
      });
    }

    const sliced = blob.slice(start, end + 1, contentType);
    return new Response(sliced, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(sliced.size),
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes'
      }
    });
  })());
});
