import type { Express, Request, Response } from 'express';
import Parser from 'rss-parser';
import dns from 'node:dns/promises';
import net from 'node:net';

const parser = new Parser({
  customFields: {
    item: ['itunes:image', 'itunes:duration', 'itunes:summary', 'itunes:subtitle', 'enclosure'],
    feed: ['itunes:image', 'image'],
  },
});

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

async function validateFeedUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https protocols are allowed');
  }

  const blockedHosts = new Set([
    'localhost',
    'metadata.google.internal',
    '169.254.169.254',
    '100.100.100.200',
  ]);

  const hostname = parsed.hostname.toLowerCase();
  if (blockedHosts.has(hostname)) {
    throw new Error('Host is blocked');
  }

  const ipType = net.isIP(hostname);
  if (ipType === 4 && isPrivateIPv4(hostname)) {
    throw new Error('Private IPv4 ranges are blocked');
  }
  if (ipType === 6 && isPrivateIPv6(hostname)) {
    throw new Error('Private IPv6 ranges are blocked');
  }

  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) {
    throw new Error('Host did not resolve to an IP');
  }

  for (const record of records) {
    if ((record.family === 4 && isPrivateIPv4(record.address)) || (record.family === 6 && isPrivateIPv6(record.address))) {
      throw new Error('Resolved private IP is blocked');
    }
  }

  return parsed;
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

      const safeUrl = await validateFeedUrl(url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(safeUrl, {
          headers: {
            'User-Agent': 'PodcastApp/1.0 (+https://example.com)',
            Accept: 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!/xml|rss|atom|text\//i.test(contentType)) {
          throw new Error(`Unexpected content-type: ${contentType}`);
        }

        const xml = await response.text();
        if (xml.length > 2_000_000) {
          throw new Error('Feed response too large');
        }

        const feed = await parser.parseString(xml.trim());
        return res.json(feed);
      } finally {
        clearTimeout(timeout);
      }
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
}
