import express from 'express';
import cors from 'cors';
import Parser from 'rss-parser';
import { createServer as createViteServer } from 'vite';
import webpush from 'web-push';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Read Firebase config
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));

// Initialize Firebase Client SDK for the backend
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(firebaseApp);

// VAPID keys for Web Push
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLcg05SRYig',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'CGcG_epFzG0YBaLpZgXVYEq9VqasTG0RKIyRGG_lIdM'
};

webpush.setVapidDetails(
  'mailto:test@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const latestEpisodesCache: Record<string, string> = {};

async function checkFeedsAndNotify(parser: Parser) {
  console.log('Checking RSS feeds for new episodes...');
  try {
    const snapshot = await getDocs(collection(db, 'pushSubscriptions'));
    const subscriptions: any[] = [];
    snapshot.forEach(doc => subscriptions.push({ id: doc.id, ...doc.data() }));

    if (subscriptions.length === 0) return;

    const podcastUrls = new Set<string>();
    subscriptions.forEach(sub => {
      if (sub.podcasts && Array.isArray(sub.podcasts)) {
        sub.podcasts.forEach((url: string) => podcastUrls.add(url));
      }
    });

    for (const url of podcastUrls) {
      try {
        const feed = await parser.parseURL(url);
        if (feed.items && feed.items.length > 0) {
          const latestEpisode = feed.items[0];
          const episodeId = latestEpisode.guid || latestEpisode.link || latestEpisode.title;
          
          if (!episodeId) continue;

          if (latestEpisodesCache[url] && latestEpisodesCache[url] !== episodeId) {
            console.log(`New episode found for ${feed.title}: ${latestEpisode.title}`);
            const payload = JSON.stringify({
              title: feed.title || 'Novo Episódio!',
              body: latestEpisode.title || 'Confira o novo episódio.',
              icon: '/icon.svg',
              url: '/'
            });

            const subscribers = subscriptions.filter(sub => sub.podcasts.includes(url));
            for (const sub of subscribers) {
              try {
                await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
              } catch (err) {
                console.error(`Failed to send notification to ${sub.endpoint}:`, err);
              }
            }
          }
          latestEpisodesCache[url] = episodeId;
        }
      } catch (err) {
        console.error(`Error parsing feed ${url}:`, err);
      }
    }
  } catch (error) {
    console.error('Error checking feeds:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const parser = new Parser({
    customFields: {
      item: ['itunes:image', 'itunes:duration', 'itunes:summary', 'itunes:subtitle', 'enclosure'],
      feed: ['itunes:image', 'image']
    }
  });

  app.get('/api/vapidPublicKey', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  // Simple in-memory cache for API responses
  const apiCache: Record<string, { data: any, timestamp: number }> = {};
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  app.get('/api/search', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json({ results: [] });
      
      const cacheKey = `search:${q}`;
      if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
        return res.json(apiCache[cacheKey].data);
      }

      const response = await fetch(`https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(q as string)}&country=br`);
      const data = await response.json();
      
      apiCache[cacheKey] = { data, timestamp: Date.now() };
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
      
      const cacheKey = `feed:${url}`;
      if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
        return res.json(apiCache[cacheKey].data);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch(url as string, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
        }

        const xml = await response.text();
        const feed = await parser.parseString(xml.trim());
        
        apiCache[cacheKey] = { data: feed, timestamp: Date.now() };
        res.json(feed);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error('Feed error:', error);
      res.status(500).json({ error: 'Failed to parse feed' });
    }
  });

  app.get('/api/top', async (req, res) => {
    try {
      const { genre } = req.query;
      const genreParam = genre ? `/genre=${genre}` : '';
      
      const cacheKey = `top:${genreParam}`;
      if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
        return res.json(apiCache[cacheKey].data);
      }

      const rssResponse = await fetch(`https://itunes.apple.com/br/rss/toppodcasts/limit=50${genreParam}/json`);
      const rssData = await rssResponse.json();
      
      const entries = rssData.feed?.entry || [];
      const ids = entries.map((e: any) => e.id.attributes['im:id']).join(',');
      
      if (!ids) return res.json({ results: [] });
      
      const lookupResponse = await fetch(`https://itunes.apple.com/lookup?id=${ids}&country=br`);
      const lookupData = await lookupResponse.json();
      
      apiCache[cacheKey] = { data: lookupData, timestamp: Date.now() };
      res.json(lookupData);
    } catch (error) {
      console.error('Top podcasts error:', error);
      res.status(500).json({ error: 'Failed to fetch top podcasts' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Authenticate backend anonymously
  signInAnonymously(auth).then(() => {
    console.log('Backend authenticated with Firebase anonymously.');
  }).catch(console.error);

  // Schedule cron job
  cron.schedule('*/15 * * * *', () => checkFeedsAndNotify(parser));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Initial check after 10 seconds
    setTimeout(() => checkFeedsAndNotify(parser), 10000);
  });
}

startServer();
