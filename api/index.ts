import express from 'express';
import cors from 'cors';
import Parser from 'rss-parser';

const app = express();

app.use(cors());

const parser = new Parser({
  customFields: {
    item: ['itunes:image', 'itunes:duration', 'itunes:summary', 'itunes:subtitle', 'enclosure'],
    feed: ['itunes:image', 'image']
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ results: [] });
    const response = await fetch(`https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(q as string)}&country=br`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

app.get('/api/feed', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const feed = await parser.parseURL(url as string);
    res.json(feed);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to parse feed' });
  }
});

app.get('/api/top', async (req, res) => {
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
    
    res.json(lookupData);
  } catch (error) {
    console.error('Top podcasts error:', error);
    res.status(500).json({ error: 'Failed to fetch top podcasts' });
  }
});

export default app;
