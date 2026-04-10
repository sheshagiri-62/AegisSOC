const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const actionRoutes = require('./routes/actions');

const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

app.use('/', authRoutes);
app.use('/', actionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/actions', actionRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, HOST, () => {
  console.log(`Backend running on locally at http://localhost:${PORT}`);
  console.log(`Network-accessible at http://${HOST}:${PORT}`);
});
