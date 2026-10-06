import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });
const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3000);
app.get('/api/foods/search', async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (query.length < 2 || query.length > 150) return res.status(400).json({ error: 'Search must be 2–150 characters' });
  try {
    const params = new URLSearchParams({ api_key: process.env.USDA_API_KEY || 'DEMO_KEY', query, pageSize: '25' });
    const upstream = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`, { signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'Food search unavailable' });
    res.json(await upstream.json());
  } catch { res.status(502).json({ error: 'Food search unavailable' }); }
});
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });
async function start() {
  if (process.env.NODE_ENV === 'production') {
    const directory = path.resolve('dist');
    app.use(express.static(directory));
    app.use((_req, res) => { res.sendFile(path.join(directory, 'index.html')); });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(port, process.env.HOST || '127.0.0.1', () => console.info(`OmniBody running on port ${port}`));
}
void start();
