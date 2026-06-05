function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick the team split for 4 players that minimizes partner repeats.
function buildCourt(four, pairingHistory) {
  const splits = [
    [[four[0], four[1]], [four[2], four[3]]],
    [[four[0], four[2]], [four[1], four[3]]],
    [[four[0], four[3]], [four[1], four[2]]],
  ];
  let best = splits[0];
  let bestScore = Infinity;
  for (const [t1, t2] of splits) {
    const score = (pairingHistory[pairKey(t1[0], t1[1])] || 0) +
                  (pairingHistory[pairKey(t2[0], t2[1])] || 0);
    if (score < bestScore) { bestScore = score; best = [t1, t2]; }
  }
  return { team1: best[0], team2: best[1] };
}

// Score a single court. Partner repeats are weighted 10x over opponent repeats
// to reflect the priority ordering (3: partner variety > 4: opponent variety).
function scoreCourt(court, pairingHistory, opponentHistory) {
  const { team1, team2 } = court;
  let cost = 0;
  cost += 10 * (pairingHistory[pairKey(team1[0], team1[1])] || 0);
  cost += 10 * (pairingHistory[pairKey(team2[0], team2[1])] || 0);
  for (const p1 of team1) {
    for (const p2 of team2) {
      cost += opponentHistory[pairKey(p1, p2)] || 0;
    }
  }
  return cost;
}

// Hill-climbing local search: try every pairwise player swap between courts and
// accept the first improvement found. Repeat until no swap helps.
// Uses delta scoring to avoid rescoring unaffected courts on every trial.
function localSearch(groups, pairingHistory, opponentHistory) {
  const n = groups.length;
  let courts = groups.map(g => buildCourt(g, pairingHistory));
  let courtScores = courts.map(c => scoreCourt(c, pairingHistory, opponentHistory));
  let score = courtScores.reduce((a, b) => a + b, 0);

  if (n < 2) return { courts, score };

  let improved = true;
  while (improved) {
    improved = false;
    outer: for (let c1 = 0; c1 < n; c1++) {
      for (let c2 = c1 + 1; c2 < n; c2++) {
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            const g1 = [...groups[c1]];
            const g2 = [...groups[c2]];
            [g1[i], g2[j]] = [g2[j], g1[i]];
            const newCourt1 = buildCourt(g1, pairingHistory);
            const newCourt2 = buildCourt(g2, pairingHistory);
            const newScore1 = scoreCourt(newCourt1, pairingHistory, opponentHistory);
            const newScore2 = scoreCourt(newCourt2, pairingHistory, opponentHistory);
            const delta = newScore1 + newScore2 - courtScores[c1] - courtScores[c2];
            if (delta < 0) {
              groups[c1] = g1;
              groups[c2] = g2;
              courts[c1] = newCourt1;
              courts[c2] = newCourt2;
              courtScores[c1] = newScore1;
              courtScores[c2] = newScore2;
              score += delta;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
  }
  return { courts, score };
}

// byeQueue: ordered array of player IDs. The first numByes players sit out
// and are rotated to the back, preserving maximum time between sit-outs.
//
// Priorities:
//   1. Bye balance  (queue guarantees equal sit-out counts)
//   2. Max playtime between sit-outs  (queue rotation guarantees this)
//   3. Partner variety  (10x weight in scoring)
//   4. Opponent variety  (1x weight in scoring)
export function generateRound(players, pairingHistory, opponentHistory, byeQueue, numCourts) {
  if (players.length < 4) throw new Error('Need at least 4 players');

  const maxActive = Math.floor(Math.min(players.length, numCourts * 4) / 4) * 4;
  const numCourtsActual = maxActive / 4;
  const numByes = players.length - maxActive;

  const byes = byeQueue.slice(0, numByes);
  const updatedQueue = [...byeQueue.slice(numByes), ...byes];

  const byeSet = new Set(byes);
  const active = players.filter(p => !byeSet.has(p.id)).map(p => p.id);

  let bestCourts = null;
  let bestScore = Infinity;
  // Fewer restarts than the old random-only approach, but each is improved by
  // local search — quality is significantly better for multi-court sessions.
  const restarts = Math.min(30, Math.max(8, numCourtsActual * 3));

  for (let i = 0; i < restarts; i++) {
    const shuffled = shuffle(active);
    const groups = [];
    for (let c = 0; c < numCourtsActual; c++) {
      groups.push(shuffled.slice(c * 4, c * 4 + 4));
    }
    const { courts, score } = localSearch(groups, pairingHistory, opponentHistory);
    if (score < bestScore) {
      bestScore = score;
      bestCourts = courts;
      if (score === 0) break;
    }
  }

  return { courts: bestCourts, byes, updatedQueue };
}
