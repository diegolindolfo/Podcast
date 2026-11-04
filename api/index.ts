import express from 'express';
import compression from 'compression';
import { apiRouter } from './router';

const app = express();

// Vercel sits in front of the function; trust its single proxy hop for client IPs (rate limiting)
app.set('trust proxy', 1);
app.use(compression());
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
