import type { Express, Request, Response } from 'express';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: ['itunes:image', 'itunes:duration', 'itunes:summary', 'itunes:subtitle', 'enclosure'],
    feed: ['itunes:image', 'image'],
  },
});

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
}
