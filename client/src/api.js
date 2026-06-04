function mcHeaders(mcToken) {
  const h = { 'Content-Type': 'application/json' };
  if (mcToken) h['X-MC-Token'] = mcToken;
  return h;
}

async function handle(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function createSession(courts) {
  return handle(await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courts }),
  }));
}

export async function getSession(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}`);
  if (res.status === 404) return null;
  return handle(res);
}

export async function addPlayer(sessionId, mcToken, name) {
  return handle(await fetch(`/api/sessions/${sessionId}/players`, {
    method: 'POST',
    headers: mcHeaders(mcToken),
    body: JSON.stringify({ name }),
  }));
}

export async function renamePlayer(sessionId, mcToken, playerId, name) {
  return handle(await fetch(`/api/sessions/${sessionId}/players/${playerId}`, {
    method: 'PATCH',
    headers: mcHeaders(mcToken),
    body: JSON.stringify({ name }),
  }));
}

export async function removePlayer(sessionId, mcToken, playerId) {
  return handle(await fetch(`/api/sessions/${sessionId}/players/${playerId}`, {
    method: 'DELETE',
    headers: mcHeaders(mcToken),
  }));
}

export async function generateRound(sessionId, mcToken) {
  return handle(await fetch(`/api/sessions/${sessionId}/rounds`, {
    method: 'POST',
    headers: mcHeaders(mcToken),
  }));
}

export async function swapPlayer(sessionId, mcToken, roundId, playerOutId, playerInId) {
  return handle(await fetch(`/api/sessions/${sessionId}/rounds/${roundId}/swap`, {
    method: 'POST',
    headers: mcHeaders(mcToken),
    body: JSON.stringify({ playerOutId, playerInId }),
  }));
}

export async function claimHost(sessionId) {
  return handle(await fetch(`/api/sessions/${sessionId}/claim-host`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }));
}

export async function updateCourts(sessionId, mcToken, courts) {
  return handle(await fetch(`/api/sessions/${sessionId}/courts`, {
    method: 'PATCH',
    headers: mcHeaders(mcToken),
    body: JSON.stringify({ courts }),
  }));
}
