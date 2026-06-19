import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.listen(PORT, () => {
  console.log(`ARAISE running on :${PORT}`);
  // Self-ping every 5 min to prevent Render sleep
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    fetch(SELF_URL).catch(() => {});
  }, 5 * 60 * 1000);
});
