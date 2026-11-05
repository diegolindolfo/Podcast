import express from 'express';
import cors from 'cors';
import Parser from 'rss-parser';
import rateLimit from 'express-rate-limit';
import dns from 'dns/promises';
import net from 'net';

// ============================================================================
// SSRF Protection & Streaming Helpers
// ============================================================================

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 0) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] >= 224) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    const mappedDotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedDotted) return isPrivateIp(mappedDotted[1]);
    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateIp(`${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`);
    }
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    return false;
  }

  return true;
}

export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protocolo não permitido. Apenas HTTP e HTTPS são suportados.');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Endereço de destino restrito ou não permitido.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Endereço IP privado não permitido.');
    }
    return parsed;
  }

  let lookupResult: { address: string }[];
  try {
    lookupResult = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Falha ao resolver o domínio de destino.');
  }
  for (const record of lookupResult) {
    if (isPrivateIp(record.address)) {
      throw new Error('Endereço IP resolvido pertence a uma rede interna restrita.');
    }
  }

  return parsed;
}

const MAX_REDIRECTS = 5;

export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await validateSafeUrl(current);
    const response = await fetch(url.toString(), { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      response.body?.cancel().catch(() => {});
      current = new URL(location, url).toString();
      continue;
    }
    return response;
  }
  throw new Error('Muitos redirecionamentos.');
}

export async function readTextLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw Object.assign(new Error('Resposta excede o tamanho máximo permitido.'), { code: 'TOO_LARGE' });
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// ============================================================================
// Cache Layer (In-Memory LRU + Optional Pluggable Persistence Adapter)
// ============================================================================

export interface CacheAdapter {
  get(key: string): any | null;
  set(key: string, data: any, ttlMs: number): void;
}

interface CacheItem {
  data: any;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheItem>();
let externalCacheAdapter: CacheAdapter | null = null;

export function registerCacheAdapter(adapter: CacheAdapter) {
  externalCacheAdapter = adapter;
}

export function getCache(key: string): any | null {
  if (externalCacheAdapter) {
    const val = externalCacheAdapter.get(key);
    if (val !== null) return val;
  }

  const now = Date.now();
  const item = memoryCache.get(key);
  if (item) {
    if (item.expiresAt > now) {
      return item.data;
    }
    memoryCache.delete(key);
  }
  return null;
}

export function setCache(key: string, data: any, ttlMs: number): void {
  if (externalCacheAdapter) {
    externalCacheAdapter.set(key, data, ttlMs);
  }

  const expiresAt = Date.now() + ttlMs;
  memoryCache.set(key, { data, expiresAt });

  if (memoryCache.size > 500) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
}

// ============================================================================
// Express Router & Serverless Entrypoint
// ============================================================================

export const apiRouter = express.Router();

apiRouter.use(cors());
apiRouter.use(express.json({ limit: '16kb' }));

apiRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  },
  message: { error: 'Muitas requisições vindas deste IP, por favor tente novamente mais tarde.' }
}));

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
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.json(cached);
    }

    const response = await fetch(`https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(q)}&country=br`);
    if (!response.ok) {
      throw new Error(`iTunes search returned status ${response.status}`);
    }
    const data = await response.json();

    setCache(cacheKey, data, SEARCH_TOP_TTL);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
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
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      return res.json(cached);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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

      const xml = await readTextLimited(response, MAX_FEED_BYTES);
      const parsedFeed = await parser.parseString(xml.trim());

      // Sanitize & compress payload: keep only what the app needs and limit to recent 300 episodes
      const sanitizedFeed = {
        title: parsedFeed.title,
        description: parsedFeed.description,
        link: parsedFeed.link,
        feedUrl: parsedFeed.feedUrl,
        image: parsedFeed.image,
        itunes: parsedFeed.itunes,
        creator: (parsedFeed as any).creator,
        items: (parsedFeed.items || []).slice(0, 300).map((item: any) => ({
          guid: item.guid,
          id: item.id,
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          contentSnippet: item.contentSnippet,
          content: item.contentSnippet || item.content || item['itunes:summary'] || item.summary || '',
          summary: item.summary,
          'itunes:summary': item['itunes:summary'],
          'itunes:duration': item['itunes:duration'],
          'itunes:image': item['itunes:image'],
          itunes: item.itunes,
          enclosure: item.enclosure ? {
            url: item.enclosure.url,
            type: item.enclosure.type,
            length: item.enclosure.length
          } : undefined
        }))
      };

      setCache(cacheKey, sanitizedFeed, FEED_TTL);
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      res.json(sanitizedFeed);
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
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.json(cached);
    }

    const rssResponse = await fetch(`https://itunes.apple.com/br/rss/toppodcasts/limit=50${genreParam}/json`);
    if (!rssResponse.ok) {
      throw new Error(`iTunes top returned status ${rssResponse.status}`);
    }
    const rssData = await rssResponse.json();

    const entries = rssData.feed?.entry || [];
    const ids = entries.map((e: any) => e.id?.attributes?.['im:id']).filter(Boolean).join(',');

    if (!ids) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.json({ results: [] });
    }

    const lookupResponse = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(ids)}&country=br`);
    if (!lookupResponse.ok) {
      throw new Error(`iTunes lookup returned status ${lookupResponse.status}`);
    }
    const lookupData = await lookupResponse.json();

    setCache(cacheKey, lookupData, SEARCH_TOP_TTL);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.json(lookupData);
  } catch (error) {
    console.error('Top podcasts error:', error);
    res.status(500).json({ error: 'Failed to fetch top podcasts' });
  }
});

const app = express();
app.set('trust proxy', 1);
// Mount on both /api and / so Vercel rewrites work regardless of path stripping
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
