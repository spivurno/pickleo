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
    expires_at INTEGER NOT NULL,
    bye_queue TEXT
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
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

// Migrations for databases that predate newer columns
try { db.exec('ALTER TABLE players ADD COLUMN archived INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE sessions ADD COLUMN bye_queue TEXT'); } catch {}
try { db.exec('ALTER TABLE sessions ADD COLUMN host_version INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE sessions ADD COLUMN name TEXT'); } catch {}
try { db.exec('ALTER TABLE sessions ADD COLUMN total_rounds INTEGER NOT NULL DEFAULT 0'); } catch {}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function createSession(id, hostToken, courts) {
  const now = Date.now();
  db.prepare(
    'INSERT INTO sessions (id, mc_token, courts, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, hostToken, courts, now, now + THIRTY_DAYS_MS);
}

export function validateHostToken(sessionId, token) {
  if (!token) return false;
  const row = db.prepare('SELECT mc_token FROM sessions WHERE id = ?').get(sessionId);
  return row?.mc_token === token;
}

export function updateCourts(sessionId, courts) {
  db.prepare('UPDATE sessions SET courts = ? WHERE id = ?').run(courts, sessionId);
}

export function addPlayer(sessionId, playerId, name) {
  db.transaction(() => {
    const clash = db.prepare(
      'SELECT 1 FROM players WHERE session_id = ? AND archived = 0 AND LOWER(name) = LOWER(?)'
    ).get(sessionId, name);
    if (clash) throw new Error(`A player named "${name}" is already on this board`);
    db.prepare(
      'INSERT INTO players (id, session_id, name, added_at, archived) VALUES (?, ?, ?, ?, 0)'
    ).run(playerId, sessionId, name, Date.now());
    // Append to queue if it has been initialized
    const row = db.prepare('SELECT bye_queue FROM sessions WHERE id = ?').get(sessionId);
    if (row?.bye_queue) {
      const q = JSON.parse(row.bye_queue);
      q.push(playerId);
      db.prepare('UPDATE sessions SET bye_queue = ? WHERE id = ?').run(JSON.stringify(q), sessionId);
    }
    // If rounds have already been generated, add the new player as a bye for the current round
    // so they appear as sitting out and are immediately available for swaps
    const latestRound = db.prepare(
      'SELECT id FROM rounds WHERE session_id = ? ORDER BY round_number DESC LIMIT 1'
    ).get(sessionId);
    if (latestRound) {
      db.prepare(
        'INSERT OR IGNORE INTO byes (round_id, session_id, player_id) VALUES (?, ?, ?)'
      ).run(latestRound.id, sessionId, playerId);
    }
  })();
}

export function archivePlayer(sessionId, playerId) {
  db.transaction(() => {
    db.prepare('UPDATE players SET archived = 1 WHERE id = ? AND session_id = ?').run(playerId, sessionId);
    const row = db.prepare('SELECT bye_queue FROM sessions WHERE id = ?').get(sessionId);
    if (row?.bye_queue) {
      const q = JSON.parse(row.bye_queue).filter(id => id !== playerId);
      db.prepare('UPDATE sessions SET bye_queue = ? WHERE id = ?').run(JSON.stringify(q), sessionId);
    }
  })();
}

export function deletePlayer(sessionId, playerId) {
  db.transaction(() => {
    db.prepare('DELETE FROM players WHERE id = ? AND session_id = ?').run(playerId, sessionId);
    // Remove from queue if present (shouldn't be active, but be safe)
    const row = db.prepare('SELECT bye_queue FROM sessions WHERE id = ?').get(sessionId);
    if (row?.bye_queue) {
      const q = JSON.parse(row.bye_queue).filter(id => id !== playerId);
      db.prepare('UPDATE sessions SET bye_queue = ? WHERE id = ?').run(JSON.stringify(q), sessionId);
    }
  })();
}

export function restorePlayer(sessionId, playerId) {
  db.transaction(() => {
    db.prepare('UPDATE players SET archived = 0 WHERE id = ? AND session_id = ?').run(playerId, sessionId);
    const row = db.prepare('SELECT bye_queue FROM sessions WHERE id = ?').get(sessionId);
    if (row?.bye_queue) {
      const q = JSON.parse(row.bye_queue);
      if (!q.includes(playerId)) q.push(playerId);
      db.prepare('UPDATE sessions SET bye_queue = ? WHERE id = ?').run(JSON.stringify(q), sessionId);
    }
  })();
}

export function renamePlayer(sessionId, playerId, name) {
  const clash = db.prepare(
    'SELECT 1 FROM players WHERE session_id = ? AND archived = 0 AND LOWER(name) = LOWER(?) AND id != ?'
  ).get(sessionId, name, playerId);
  if (clash) throw new Error(`A player named "${name}" is already on this board`);
  db.prepare('UPDATE players SET name = ? WHERE id = ? AND session_id = ?').run(name, playerId, sessionId);
}

export function claimHost(sessionId) {
  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  db.prepare('UPDATE sessions SET mc_token = ?, host_version = host_version + 1 WHERE id = ?').run(token, sessionId);
  const row = db.prepare('SELECT host_version FROM sessions WHERE id = ?').get(sessionId);
  return { token, version: row.host_version };
}

export function resetBoard(sessionId) {
  db.transaction(() => {
    db.prepare('DELETE FROM rounds WHERE session_id = ?').run(sessionId);
    db.prepare('UPDATE players SET archived = 1 WHERE session_id = ?').run(sessionId);
    db.prepare('UPDATE sessions SET bye_queue = NULL WHERE id = ?').run(sessionId);
  })();
}

export function renameBoard(sessionId, name) {
  db.prepare('UPDATE sessions SET name = ? WHERE id = ?').run(name || null, sessionId);
}

export function updateByeQueue(sessionId, queue) {
  db.prepare('UPDATE sessions SET bye_queue = ? WHERE id = ?').run(JSON.stringify(queue), sessionId);
}

export function saveRound(sessionId, roundId, { courts, byes }) {
  const roundNumber =
    db.prepare('SELECT COUNT(*) AS c FROM rounds WHERE session_id = ?').get(sessionId).c + 1;

  db.transaction(() => {
    db.prepare(
      'INSERT INTO rounds (id, session_id, round_number, created_at) VALUES (?, ?, ?, ?)'
    ).run(roundId, sessionId, roundNumber, Date.now());
    db.prepare('UPDATE sessions SET total_rounds = total_rounds + 1 WHERE id = ?').run(sessionId);

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
      const inPos = cols.find(c => inGame[c] === playerInId);
      db.prepare(`UPDATE games SET ${outPos}=? WHERE id=?`).run(playerInId, outGame.id);
      db.prepare(`UPDATE games SET ${inPos}=? WHERE id=?`).run(playerOutId, inGame.id);
    } else {
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
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(Date.now() + THIRTY_DAYS_MS, sessionId);

  const players = db.prepare(
    'SELECT id, name FROM players WHERE session_id = ? AND archived = 0 ORDER BY added_at'
  ).all(sessionId);

  const archivedPlayers = db.prepare(
    'SELECT id, name FROM players WHERE session_id = ? AND archived = 1 ORDER BY added_at'
  ).all(sessionId);

  const allPlayers = db.prepare(
    'SELECT id, name FROM players WHERE session_id = ?'
  ).all(sessionId);
  const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p.name]));

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

  const allGames = db.prepare(
    'SELECT t1p1, t1p2, t2p1, t2p2 FROM games WHERE session_id = ?'
  ).all(sessionId);
  const pairingHistory = {};
  const opponentHistory = {};
  for (const g of allGames) {
    const addPair = (a, b, hist) => {
      const k = pairKey(a, b);
      hist[k] = (hist[k] || 0) + 1;
    };
    addPair(g.t1p1, g.t1p2, pairingHistory);
    addPair(g.t2p1, g.t2p2, pairingHistory);
    addPair(g.t1p1, g.t2p1, opponentHistory);
    addPair(g.t1p1, g.t2p2, opponentHistory);
    addPair(g.t1p2, g.t2p1, opponentHistory);
    addPair(g.t1p2, g.t2p2, opponentHistory);
  }

  const allByes = db.prepare(
    'SELECT player_id FROM byes WHERE session_id = ?'
  ).all(sessionId);
  const byeHistory = {};
  for (const b of allByes) {
    byeHistory[b.player_id] = (byeHistory[b.player_id] || 0) + 1;
  }

  const lastRound = enrichedRounds.at(-1);
  const byeQueue = session.bye_queue ? JSON.parse(session.bye_queue) : null;

  return {
    id: session.id,
    name: session.name || null,
    courts: session.courts,
    hostVersion: session.host_version ?? 0,
    totalRounds: session.total_rounds ?? 0,
    players,
    archivedPlayers,
    rounds: enrichedRounds,
    currentRound: lastRound ?? null,
    pairingHistory,
    opponentHistory,
    byeHistory,
    byeQueue,
  };
}

export function cleanupExpired() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
