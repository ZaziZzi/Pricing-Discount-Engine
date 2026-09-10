const express = require('express');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Hut 3 Pricing & Discount Engine backend is running.'
  });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
