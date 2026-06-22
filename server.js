import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our Vercel functions to act as Express routes
import fetchSnapshot from './api/fetch-snapshot.js';
import fetchCeaRe from './api/fetch-cea-re.js';
import fetchNpp from './api/fetch-npp.js';
import fetchCeaMonthly from './api/fetch-cea-monthly.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

// Wrapper to adapt Vercel req/res to Express req/res
const adaptVercelHandler = (handler) => {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('Error executing handler:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  };
};

// Mount API routes
app.all('/api/fetch-snapshot', adaptVercelHandler(fetchSnapshot));
app.all('/api/fetch-cea-re', adaptVercelHandler(fetchCeaRe));
app.all('/api/fetch-npp', adaptVercelHandler(fetchNpp));
app.all('/api/fetch-cea-monthly', adaptVercelHandler(fetchCeaMonthly));

// Serve static frontend files from 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// For any other route, serve the frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
