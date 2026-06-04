function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function partnershipScore(t1, t2, history) {
  return (history[pairKey(t1[0], t1[1])] || 0) + (history[pairKey(t2[0], t2[1])] || 0);
}

function bestTeamSplit(four, history) {
  const splits = [
    [[four[0], four[1]], [four[2], four[3]]],
    [[four[0], four[2]], [four[1], four[3]]],
    [[four[0], four[3]], [four[1], four[2]]],
  ];
  let best = splits[0];
  let bestScore = Infinity;
  for (const [t1, t2] of splits) {
    const score = partnershipScore(t1, t2, history);
    if (score < bestScore) { bestScore = score; best = [t1, t2]; }
  }
  return best;
}

export function generateRound(players, pairingHistory, byeHistory, numCourts) {
  if (players.length < 4) throw new Error('Need at least 4 players');

  const maxActive = Math.floor(Math.min(players.length, numCourts * 4) / 4) * 4;
  const numCourtsActual = maxActive / 4;

  // Players with fewer byes get priority to play
  const sorted = [...players].sort((a, b) => {
    const diff = (byeHistory[a.id] || 0) - (byeHistory[b.id] || 0);
    return diff !== 0 ? diff : Math.random() - 0.5;
  });

  const active = sorted.slice(0, maxActive).map(p => p.id);
  const byes = sorted.slice(maxActive).map(p => p.id);

  // Random restarts — keep the arrangement with the fewest repeated partnerships
  let bestCourts = null;
  let bestScore = Infinity;
  const attempts = Math.min(500, Math.max(100, 10 * players.length));

  for (let i = 0; i < attempts; i++) {
    const shuffled = shuffle(active);
    const courts = [];
    let score = 0;

    for (let c = 0; c < numCourtsActual; c++) {
      const four = shuffled.slice(c * 4, c * 4 + 4);
      const [t1, t2] = bestTeamSplit(four, pairingHistory);
      courts.push({ team1: t1, team2: t2 });
      score += partnershipScore(t1, t2, pairingHistory);
    }

    if (score < bestScore) {
      bestScore = score;
      bestCourts = courts;
      if (score === 0) break;
    }
  }

  return { courts: bestCourts, byes };
}
