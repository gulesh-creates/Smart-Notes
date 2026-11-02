import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import syncRoutes from './routes/syncRoutes';
import assetRoutes from './routes/assetRoutes';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'smart-notes-sync-server',
    time: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/assets', assetRoutes);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Smart Notes Sync Server] Running on http://localhost:${PORT}`);
  });
}

export default app;
