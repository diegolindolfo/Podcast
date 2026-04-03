import express from 'express';
import cors from 'cors';
import { registerPodcastApi } from '../shared/podcastApi';

const app = express();

app.use(cors());
registerPodcastApi(app);

export default app;
