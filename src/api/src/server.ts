import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Express API!' });
});

// Optional: friendly root message (so http://localhost:3001/ is not "Cannot GET /")
app.get('/', (_req, res) => {
  res.type('text/plain').send('API up. Try GET /api/hello');
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
