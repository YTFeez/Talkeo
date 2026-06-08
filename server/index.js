require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const auth = require('./auth');
const db = require('./db');
const { attachGameHandlers } = require('./game');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', game: 'Arena FPS' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await auth.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await auth.login(req.body);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/me', auth.authMiddleware, (req, res) => {
  const user = db.findUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  res.json({ user });
});

app.get('/api/leaderboard', (_req, res) => {
  res.json({ leaderboard: db.getLeaderboard() });
});

const game = attachGameHandlers(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = auth.verifyToken(token);
  if (!payload) {
    return next(new Error('Authentification requise.'));
  }
  socket.user = payload;
  next();
});

io.on('connection', (socket) => {
  game.onJoin(socket, socket.user);

  socket.on('game:move', (data) => game.onMove(socket, data));
  socket.on('game:shoot', () => game.onShoot(socket));

  socket.on('disconnect', () => game.onDisconnect(socket));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Arena FPS en ligne sur le port ${PORT}`);
});
