import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { randomBytes, randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as db from './db.js';
import { generateRound, shuffle } from './algorithm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'client/dist')));
}

// WebSocket rooms: sessionId -> Set<WebSocket>
const rooms = new Map();

function broadcast(sessionId, data) {
  const room = rooms.get(sessionId);
  if (!room) return;
  const msg = JSON.stringify(data);
  for (const ws of room) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function broadcastState(sessionId) {
  const state = db.getSessionState(sessionId);
  if (state) broadcast(sessionId, { type: 'state', data: state });
}

wss.on('connection', (ws, req) => {
  const sessionId = new URL(req.url, 'http://x').searchParams.get('sessionId');
  if (!sessionId) { ws.close(); return; }

  if (!rooms.has(sessionId)) rooms.set(sessionId, new Set());
  rooms.get(sessionId).add(ws);

  // Send current state immediately on connect
  const state = db.getSessionState(sessionId);
  if (state) ws.send(JSON.stringify({ type: 'state', data: state }));
  else ws.send(JSON.stringify({ type: 'error', message: 'Board not found' }));

  ws.on('close', () => {
    const room = rooms.get(sessionId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) rooms.delete(sessionId);
    }
  });
});

// Host auth middleware
function requireHost(req, res, next) {
  if (!db.validateHostToken(req.params.sessionId, req.headers['x-host-token'])) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ── Routes ─────────────────────────────────────────────────────────────────

app.post('/api/sessions', (req, res) => {
  const courts = Math.max(1, parseInt(req.body.courts) || 2);
  const sessionId = randomBytes(4).toString('hex'); // 8-char shareable ID
  const hostToken = randomBytes(20).toString('hex');
  db.createSession(sessionId, hostToken, courts);
  res.json({ sessionId, hostToken });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const state = db.getSessionState(req.params.sessionId);
  if (!state) return res.status(404).json({ error: 'Board not found or expired' });
  res.json(state);
});

app.patch('/api/sessions/:sessionId/courts', requireHost, (req, res) => {
  const courts = Math.max(1, parseInt(req.body.courts) || 1);
  db.updateCourts(req.params.sessionId, courts);
  broadcastState(req.params.sessionId);
  res.json({ ok: true });
});

app.post('/api/sessions/:sessionId/players', requireHost, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const playerId = randomUUID();
    db.addPlayer(req.params.sessionId, playerId, name);
    broadcastState(req.params.sessionId);
    res.json({ playerId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch('/api/sessions/:sessionId/players/:playerId', requireHost, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    db.renamePlayer(req.params.sessionId, req.params.playerId, name);
    broadcastState(req.params.sessionId);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/sessions/:sessionId/players/:playerId', requireHost, (req, res) => {
  db.archivePlayer(req.params.sessionId, req.params.playerId);
  broadcastState(req.params.sessionId);
  res.json({ ok: true });
});

app.post('/api/sessions/:sessionId/players/:playerId/restore', requireHost, (req, res) => {
  db.restorePlayer(req.params.sessionId, req.params.playerId);
  broadcastState(req.params.sessionId);
  res.json({ ok: true });
});

app.delete('/api/sessions/:sessionId/players/:playerId/permanent', requireHost, (req, res) => {
  db.deletePlayer(req.params.sessionId, req.params.playerId);
  broadcastState(req.params.sessionId);
  res.json({ ok: true });
});

app.post('/api/sessions/:sessionId/reset', requireHost, (req, res) => {
  db.resetBoard(req.params.sessionId);
  broadcastState(req.params.sessionId);
  res.json({ ok: true });
});

app.post('/api/sessions/:sessionId/claim-host', (req, res) => {
  const state = db.getSessionState(req.params.sessionId);
  if (!state) return res.status(404).json({ error: 'Board not found' });
  const hostToken = db.claimHost(req.params.sessionId);
  res.json({ hostToken });
});

app.post('/api/sessions/:sessionId/rounds', requireHost, (req, res) => {
  const { sessionId } = req.params;
  const state = db.getSessionState(sessionId);
  if (!state) return res.status(404).json({ error: 'Board not found' });
  if (state.players.length < 4) {
    return res.status(400).json({ error: 'Need at least 4 players to generate a round' });
  }
  try {
    // Initialize the bye queue on first round; persist for all subsequent rounds.
    const byeQueue = state.byeQueue ?? shuffle(state.players.map(p => p.id));
    const round = generateRound(state.players, state.pairingHistory, state.opponentHistory, byeQueue, state.courts);
    db.saveRound(sessionId, randomUUID(), round);
    db.updateByeQueue(sessionId, round.updatedQueue);
    broadcastState(sessionId);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/sessions/:sessionId/rounds/:roundId/swap', requireHost, (req, res) => {
  const { sessionId, roundId } = req.params;
  const { playerOutId, playerInId } = req.body;
  if (!playerOutId || !playerInId) {
    return res.status(400).json({ error: 'playerOutId and playerInId required' });
  }
  try {
    db.swapPlayer(sessionId, roundId, playerOutId, playerInId);
    broadcastState(sessionId);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// SPA fallback for production
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(join(__dirname, 'client/dist/index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Clean up expired sessions every hour
setInterval(() => db.cleanupExpired(), 60 * 60 * 1000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
