import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirSync } from 'fs';

const DATA_DIR = process.env.DATA_DIR || './data';
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'pickleball.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    mc_token TEXT NOT NULL,
    courts INTEGER NOT NULL DEFAULT 2,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    court_number INTEGER NOT NULL,
    t1p1 TEXT NOT NULL,
    t1p2 TEXT NOT NULL,
    t2p1 TEXT NOT NULL,
    t2p2 TEXT NOT NULL,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS byes (
    round_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    PRIMARY KEY (round_id, player_id)
  );
`);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function createSession(id, mcToken, courts) {
  const now = Date.now();
  db.prepare(
    'INSERT INTO sessions (id, mc_token, courts, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, mcToken, courts, now, now + WEEK_MS);
}

export function validateMCToken(sessionId, token) {
  if (!token) return false;
  const row = db.prepare('SELECT mc_token FROM sessions WHERE id = ?').get(sessionId);
  return row?.mc_token === token;
}

export function updateCourts(sessionId, courts) {
  db.prepare('UPDATE sessions SET courts = ? WHERE id = ?').run(courts, sessionId);
}

export function addPlayer(sessionId, playerId, name) {
  db.prepare(
    'INSERT INTO players (id, session_id, name, added_at) VALUES (?, ?, ?, ?)'
  ).run(playerId, sessionId, name, Date.now());
}

export function removePlayer(sessionId, playerId) {
  db.prepare('DELETE FROM players WHERE id = ? AND session_id = ?').run(playerId, sessionId);
}

export function renamePlayer(sessionId, playerId, name) {
  db.prepare('UPDATE players SET name = ? WHERE id = ? AND session_id = ?').run(name, playerId, sessionId);
}

export function saveRound(sessionId, roundId, { courts, byes }) {
  const roundNumber =
    db.prepare('SELECT COUNT(*) AS c FROM rounds WHERE session_id = ?').get(sessionId).c + 1;

  db.transaction(() => {
    db.prepare(
      'INSERT INTO rounds (id, session_id, round_number, created_at) VALUES (?, ?, ?, ?)'
    ).run(roundId, sessionId, roundNumber, Date.now());

    courts.forEach((court, i) => {
      db.prepare(
        'INSERT INTO games (id, round_id, session_id, court_number, t1p1, t1p2, t2p1, t2p2) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), roundId, sessionId, i + 1, ...court.team1, ...court.team2);
    });

    byes.forEach(playerId => {
      db.prepare(
        'INSERT INTO byes (round_id, session_id, player_id) VALUES (?, ?, ?)'
      ).run(roundId, sessionId, playerId);
    });
  })();
}

export function swapPlayer(sessionId, roundId, playerOutId, playerInId) {
  db.transaction(() => {
    const cols = ['t1p1', 't1p2', 't2p1', 't2p2'];

    const outGame = db.prepare(`
      SELECT id, t1p1, t1p2, t2p1, t2p2 FROM games
      WHERE round_id = ? AND (t1p1=? OR t1p2=? OR t2p1=? OR t2p2=?)
    `).get(roundId, playerOutId, playerOutId, playerOutId, playerOutId);

    if (!outGame) throw new Error('playerOut not in any active game this round');
    const outPos = cols.find(c => outGame[c] === playerOutId);

    const inGame = db.prepare(`
      SELECT id, t1p1, t1p2, t2p1, t2p2 FROM games
      WHERE round_id = ? AND (t1p1=? OR t1p2=? OR t2p1=? OR t2p2=?)
    `).get(roundId, playerInId, playerInId, playerInId, playerInId);

    if (inGame) {
      // Swap two active players between courts
      const inPos = cols.find(c => inGame[c] === playerInId);
      db.prepare(`UPDATE games SET ${outPos}=? WHERE id=?`).run(playerInId, outGame.id);
      db.prepare(`UPDATE games SET ${inPos}=? WHERE id=?`).run(playerOutId, inGame.id);
    } else {
      // Swap active player with a bye player
      db.prepare(`UPDATE games SET ${outPos}=? WHERE id=?`).run(playerInId, outGame.id);
      db.prepare('DELETE FROM byes WHERE round_id=? AND player_id=?').run(roundId, playerInId);
      db.prepare(
        'INSERT INTO byes (round_id, session_id, player_id) VALUES (?,?,?)'
      ).run(roundId, sessionId, playerOutId);
    }
  })();
}

export function getSessionState(sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session || Date.now() > session.expires_at) return null;

  const players = db.prepare(
    'SELECT id, name FROM players WHERE session_id = ? ORDER BY added_at'
  ).all(sessionId);
  const playerMap = Object.fromEntries(players.map(p => [p.id, p.name]));

  const resolve = id => ({ id, name: playerMap[id] ?? '[Removed]' });

  const rounds = db.prepare(
    'SELECT * FROM rounds WHERE session_id = ? ORDER BY round_number'
  ).all(sessionId);

  const enrichedRounds = rounds.map(round => {
    const games = db.prepare(
      'SELECT * FROM games WHERE round_id = ? ORDER BY court_number'
    ).all(round.id);
    const byeRows = db.prepare(
      'SELECT player_id FROM byes WHERE round_id = ?'
    ).all(round.id);

    return {
      id: round.id,
      roundNumber: round.round_number,
      courts: games.map(g => ({
        id: g.id,
        courtNumber: g.court_number,
        team1: [resolve(g.t1p1), resolve(g.t1p2)],
        team2: [resolve(g.t2p1), resolve(g.t2p2)],
      })),
      byes: byeRows.map(b => resolve(b.player_id)),
    };
  });

  // Build pairing history from all games (partnerships only — same team)
  const allGames = db.prepare(
    'SELECT t1p1, t1p2, t2p1, t2p2 FROM games WHERE session_id = ?'
  ).all(sessionId);
  const pairingHistory = {};
  for (const g of allGames) {
    const add = (a, b) => {
      const k = pairKey(a, b);
      pairingHistory[k] = (pairingHistory[k] || 0) + 1;
    };
    add(g.t1p1, g.t1p2);
    add(g.t2p1, g.t2p2);
  }

  const allByes = db.prepare(
    'SELECT player_id FROM byes WHERE session_id = ?'
  ).all(sessionId);
  const byeHistory = {};
  for (const b of allByes) {
    byeHistory[b.player_id] = (byeHistory[b.player_id] || 0) + 1;
  }

  return {
    id: session.id,
    courts: session.courts,
    players,
    rounds: enrichedRounds,
    currentRound: enrichedRounds.at(-1) ?? null,
    pairingHistory,
    byeHistory,
  };
}

export function cleanupExpired() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
