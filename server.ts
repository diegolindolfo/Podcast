import express from 'express';
import compression from 'compression';
import path from 'path';
import { apiRouter } from './api/router';

// `npm start` passes --prod so production mode does not depend on NODE_ENV being set
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust the first reverse proxy hop only in production (so X-Forwarded-For can't be spoofed locally)
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(compression());

  // API routes (rate limiting lives inside the shared router)
  app.use('/api', apiRouter);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
