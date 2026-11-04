import express from 'express';
import cors from 'cors';
import Parser from 'rss-parser';
import webpush from 'web-push';
import rateLimit from 'express-rate-limit';
import { getCache, setCache } from './cache';
import { safeFetch, readTextLimited } from './ssrf';

export const apiRouter = express.Router();

apiRouter.use(cors());
apiRouter.use(express.json({ limit: '16kb' }));

// Rate limiter shared by the local server and the Vercel function
apiRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições vindas deste IP, por favor tente novamente mais tarde.' }
}));

// VAPID keys for Web Push
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:support@podcastapp.local',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (err) {
    console.warn('Erro ao configurar VAPID details:', err);
  }
}

// In-memory push subscriptions store (subId -> subscription).
// NOTE: not persistent; lost on restart and not shared between serverless instances.
const pushSubscriptions = new Map<string, any>();

const parser = new Parser({
  customFields: {
    item: ['itunes:image', 'itunes:duration', 'itunes:summary', 'itunes:subtitle', 'enclosure'],
    feed: ['itunes:image', 'image']
  }
});

const SEARCH_TOP_TTL = 60 * 60 * 1000; // 1 hour
const FEED_TTL = 15 * 60 * 1000; // 15 minutes
const MAX_FEED_BYTES = 10 * 1024 * 1024; // 10MB

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRouter.get('/vapidPublicKey', (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Endpoint to store web push subscription
apiRouter.post('/subscribe', (req, res) => {
  try {
    const { subscription, subId } = req.body;
    if (!subscription || typeof subscription.endpoint !== 'string') {
      return res.status(400).json({ error: 'Assinatura push inválida.' });
    }
    const key = typeof subId === 'string' && subId ? subId : subscription.endpoint;
    pushSubscriptions.set(key, subscription);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar subscription push:', err);
    res.status(500).json({ error: 'Falha ao registrar assinatura push.' });
  }
});

// Send a test push notification to the caller's own device
apiRouter.post('/send-test-push', async (req, res) => {
  try {
    const { subId } = req.body;
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      return res.status(400).json({ error: 'VAPID keys não configuradas no servidor (.env).' });
    }
    if (!subId || typeof subId !== 'string') {
      return res.status(400).json({ error: 'subId é obrigatório.' });
    }

    const targetSub = pushSubscriptions.get(subId);
    if (!targetSub) {
      return res.status(404).json({ error: 'Dispositivo não registrado para receber push.' });
    }

    const payload = JSON.stringify({
      title: 'Episódio Novo!',
      body: 'Notificação de teste enviada pelo servidor.',
      icon: '/icon-192.png',
      data: { url: '/' }
    });

    await webpush.sendNotification(targetSub, payload);
    res.json({ success: true, message: 'Notificação push enviada com sucesso!' });
  } catch (err: any) {
    console.error('Erro ao disparar push notification:', err);
    res.status(500).json({ error: 'Falha ao disparar push notification.' });
  }
});

// Audio proxy to bypass CORS restrictions on audio CDNs
apiRouter.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'PodcastApp/1.0 (Audio Downloader; +https://github.com/diegolindolfo/Podcast)'
    };
    if (typeof req.headers.range === 'string') {
      headers['Range'] = req.headers.range;
    }

    let response: Response;
    try {
      response = await safeFetch(url, { headers });
    } catch (validationErr: any) {
      return res.status(400).json({ error: validationErr.message || 'URL de áudio rejeitada por segurança.' });
    }

    if (!response.ok && response.status !== 206) {
      response.body?.cancel().catch(() => {});
      return res.status(502).json({ error: `Falha ao obter áudio: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || '';
    // Only relay audio, so the proxy cannot be abused as a generic open relay
    if (!/^(audio\/|application\/octet-stream|video\/mp4|binary\/octet-stream)/i.test(contentType)) {
      response.body?.cancel().catch(() => {});
      return res.status(415).json({ error: 'O proxy aceita apenas arquivos de áudio.' });
    }

    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');

    res.status(response.status);
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    if (!response.body) {
      return res.end();
    }

    const reader = response.body.getReader();
    // Stop pulling from upstream if the client disconnects
    req.on('close', () => { reader.cancel().catch(() => {}); });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && !res.write(Buffer.from(value))) {
        await new Promise((resolve) => res.once('drain', resolve));
      }
    }
    res.end();
  } catch (error: any) {
    console.error('Proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro no proxy de áudio' });
    } else {
      res.end();
    }
  }
});

apiRouter.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') return res.json({ results: [] });

    const cacheKey = `search:${q.trim().toLowerCase()}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const response = await fetch(`https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(q)}&country=br`);
    if (!response.ok) {
      throw new Error(`iTunes search returned status ${response.status}`);
    }
    const data = await response.json();

    setCache(cacheKey, data, SEARCH_TOP_TTL);
    res.json(data);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

apiRouter.get('/feed', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }

    const cacheKey = `feed:${url}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      let response: Response;
      try {
        response = await safeFetch(url, {
          headers: {
            'User-Agent': 'PodcastApp/1.0 (RSS Reader; +https://github.com/diegolindolfo/Podcast)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          },
          signal: controller.signal
        });
      } catch (validationErr: any) {
        if (validationErr.name === 'AbortError') throw validationErr;
        return res.status(400).json({ error: validationErr.message || 'URL de feed rejeitada por segurança.' });
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
      }

      // Enforced while streaming, so chunked responses without Content-Length are also limited
      const xml = await readTextLimited(response, MAX_FEED_BYTES);
      const feed = await parser.parseString(xml.trim());

      setCache(cacheKey, feed, FEED_TTL);
      res.json(feed);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: any) {
    console.error('Feed error:', error);
    if (error.code === 'TOO_LARGE') {
      return res.status(413).json({ error: 'Feed RSS excede o tamanho máximo de 10MB.' });
    }
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout ao buscar feed RSS.' });
    }
    res.status(500).json({ error: 'Failed to parse feed' });
  }
});

apiRouter.get('/top', async (req, res) => {
  try {
    const { genre } = req.query;
    const sanitizedGenre = typeof genre === 'string' && /^\d+$/.test(genre) ? genre : '';
    const genreParam = sanitizedGenre ? `/genre=${sanitizedGenre}` : '';

    const cacheKey = `top:${genreParam}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const rssResponse = await fetch(`https://itunes.apple.com/br/rss/toppodcasts/limit=50${genreParam}/json`);
    if (!rssResponse.ok) {
      throw new Error(`iTunes top returned status ${rssResponse.status}`);
    }
    const rssData = await rssResponse.json();

    const entries = rssData.feed?.entry || [];
    const ids = entries.map((e: any) => e.id?.attributes?.['im:id']).filter(Boolean).join(',');

    if (!ids) return res.json({ results: [] });

    const lookupResponse = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(ids)}&country=br`);
    if (!lookupResponse.ok) {
      throw new Error(`iTunes lookup returned status ${lookupResponse.status}`);
    }
    const lookupData = await lookupResponse.json();

    setCache(cacheKey, lookupData, SEARCH_TOP_TTL);
    res.json(lookupData);
  } catch (error) {
    console.error('Top podcasts error:', error);
    res.status(500).json({ error: 'Failed to fetch top podcasts' });
  }
});
