import type { Express, Request, Response } from 'express';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: ['itunes:image', 'itunes:duration', 'itunes:summary', 'itunes:subtitle', 'enclosure'],
    feed: ['itunes:image', 'image'],
  },
});

type NetworkCheckResult = {
  ok: boolean;
  status?: number;
  statusText?: string;
  durationMs: number;
  error?: string;
  code?: string;
};

async function checkUrl(url: string, timeoutMs = 5000): Promise<NetworkCheckResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'PodcastDebug/1.0',
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException };
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: err.message,
      code: err.code || err.cause?.code,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function registerPodcastApi(app: Express): void {
  app.get('/api/search', async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      if (!q) return res.json({ results: [] });
      const response = await fetch(`https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(q as string)}&country=br`);
      const data = await response.json();
      return res.json(data);
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({ error: 'Failed to search' });
    }
  });

  app.get('/api/feed', async (req: Request, res: Response) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL is required' });
      const feed = await parser.parseURL(url);
      return res.json(feed);
    } catch (error) {
      console.error('Feed error:', error);
      return res.status(500).json({ error: 'Failed to parse feed' });
    }
  });

  app.get('/api/top', async (req: Request, res: Response) => {
    try {
      const { genre } = req.query;
      const genreParam = genre ? `/genre=${genre}` : '';
      const rssResponse = await fetch(`https://itunes.apple.com/br/rss/toppodcasts/limit=50${genreParam}/json`);
      const rssData = await rssResponse.json();

      const entries = rssData.feed?.entry || [];
      const ids = entries.map((e: any) => e.id.attributes['im:id']).join(',');

      if (!ids) return res.json({ results: [] });

      const lookupResponse = await fetch(`https://itunes.apple.com/lookup?id=${ids}&country=br`);
      const lookupData = await lookupResponse.json();

      return res.json(lookupData);
    } catch (error) {
      console.error('Top podcasts error:', error);
      return res.status(500).json({ error: 'Failed to fetch top podcasts' });
    }
  });

  app.get('/api/debug/network', async (req: Request, res: Response) => {
    const searchTerm = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : 'flow';
    const feedUrl = typeof req.query.feedUrl === 'string' && req.query.feedUrl.trim()
      ? req.query.feedUrl.trim()
      : 'https://feeds.simplecast.com/54nAGcIl';
    const timeoutMsRaw = Number(req.query.timeoutMs);
    const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? Math.min(timeoutMsRaw, 15000) : 5000;

    const itunesSearchUrl = `https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(searchTerm)}&country=br&limit=1`;
    const itunesTopUrl = 'https://itunes.apple.com/br/rss/toppodcasts/limit=1/json';

    const [searchCheck, topCheck, feedCheck] = await Promise.all([
      checkUrl(itunesSearchUrl, timeoutMs),
      checkUrl(itunesTopUrl, timeoutMs),
      checkUrl(feedUrl, timeoutMs),
    ]);

    const hasProxyEnv = Boolean(
      process.env.HTTP_PROXY
      || process.env.HTTPS_PROXY
      || process.env.http_proxy
      || process.env.https_proxy,
    );

    return res.json({
      ok: searchCheck.ok && topCheck.ok && feedCheck.ok,
      timestamp: new Date().toISOString(),
      timeoutMs,
      hasProxyEnv,
      checks: {
        itunesSearch: { url: itunesSearchUrl, ...searchCheck },
        itunesTop: { url: itunesTopUrl, ...topCheck },
        feedUrl: { url: feedUrl, ...feedCheck },
      },
    });
  });
}
