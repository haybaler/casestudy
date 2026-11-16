import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { warehouse } from './server/warehouse.ts';
import { answerWarehouseQuestion } from './server/textToSql.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/metadata', (_req, res) => {
    try {
      res.json(warehouse.getMetadata());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/executive', (req, res) => {
    try {
      const data = warehouse.getExecutiveSummary({
        quarter: typeof req.query.quarter === 'string' ? req.query.quarter : undefined,
        accountType:
          typeof req.query.accountType === 'string' ? req.query.accountType : undefined,
        territory:
          typeof req.query.territory === 'string' ? req.query.territory : undefined,
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/attribution', (req, res) => {
    try {
      const data = warehouse.getAttributionData({
        quarter: typeof req.query.quarter === 'string' ? req.query.quarter : undefined,
        accountType:
          typeof req.query.accountType === 'string' ? req.query.accountType : undefined,
        territory:
          typeof req.query.territory === 'string' ? req.query.territory : undefined,
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/health', (req, res) => {
    try {
      const data = warehouse.getAccountHealthData({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        accountType:
          typeof req.query.accountType === 'string' ? req.query.accountType : undefined,
        territory:
          typeof req.query.territory === 'string' ? req.query.territory : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/accounts/:id', (req, res) => {
    try {
      const detail = warehouse.getAccountDetail(req.params.id);
      if (!detail) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }
      res.json(detail);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/models', (_req, res) => {
    try {
      res.json({ models: warehouse.getSqlModels() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/ask', async (req, res) => {
    try {
      const question = typeof req.body?.question === 'string' ? req.body.question : '';
      const result = await answerWarehouseQuestion(question);
      res.json(result);
    } catch (err) {
      const message = (err as Error).message || 'Failed to answer question.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/sql', (req, res) => {
    try {
      const sql = typeof req.body?.sql === 'string' ? req.body.sql : '';
      const result = warehouse.executeSafeReadQuery(sql);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Commercial Intelligence Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
