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
import { registerPodcastApi } from './shared/podcastApi';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const hasVapidKeys = Boolean(vapidPublicKey && vapidPrivateKey);

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error('Missing VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY environment variables.');
}

const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(firebaseApp);

if (hasVapidKeys) {
  webpush.setVapidDetails('mailto:test@example.com', vapidPublicKey!, vapidPrivateKey!);
} else {
  console.warn('VAPID keys are missing. Push notifications are disabled, but API/search remain available.');
}
webpush.setVapidDetails('mailto:test@example.com', vapidPublicKey, vapidPrivateKey);

const latestEpisodesCache: Record<string, string> = {};

async function checkFeedsAndNotify(parser: Parser) {
  if (!hasVapidKeys) return;
  console.log('Checking RSS feeds for new episodes...');
  try {
    const snapshot = await getDocs(collection(db, 'pushSubscriptions'));
    const subscriptions: any[] = [];
    snapshot.forEach((doc) => subscriptions.push({ id: doc.id, ...doc.data() }));

    if (subscriptions.length === 0) return;

    const podcastUrls = new Set<string>();
    subscriptions.forEach((sub) => {
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
              url: '/',
            });

            const subscribers = subscriptions.filter((sub) => sub.podcasts.includes(url));
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

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/vapidPublicKey', (_req, res) => {
    if (!vapidPublicKey) {
      return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
    }
    return res.json({ publicKey: vapidPublicKey });
  });

  registerPodcastApi(app);

    res.json({ publicKey: vapidPublicKey });
  });

  registerPodcastApi(app);

  const parser = new Parser({
    customFields: {
      item: ['itunes:image', 'itunes:duration', 'itunes:summary', 'itunes:subtitle', 'enclosure'],
      feed: ['itunes:image', 'image'],
    },
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
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  signInAnonymously(auth)
    .then(() => {
      console.log('Backend authenticated with Firebase anonymously.');
    })
    .catch(console.error);

  cron.schedule('*/15 * * * *', () => checkFeedsAndNotify(parser));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    setTimeout(() => checkFeedsAndNotify(parser), 10000);
  });
}

startServer();
