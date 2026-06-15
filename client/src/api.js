function hostHeaders(hostToken) {
  const h = { 'Content-Type': 'application/json' };
  if (hostToken) h['X-Host-Token'] = hostToken;
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

export async function addPlayer(sessionId, hostToken, name) {
  return handle(await fetch(`/api/sessions/${sessionId}/players`, {
    method: 'POST',
    headers: hostHeaders(hostToken),
    body: JSON.stringify({ name }),
  }));
}

export async function renamePlayer(sessionId, hostToken, playerId, name) {
  return handle(await fetch(`/api/sessions/${sessionId}/players/${playerId}`, {
    method: 'PATCH',
    headers: hostHeaders(hostToken),
    body: JSON.stringify({ name }),
  }));
}

export async function removePlayer(sessionId, hostToken, playerId) {
  return handle(await fetch(`/api/sessions/${sessionId}/players/${playerId}`, {
    method: 'DELETE',
    headers: hostHeaders(hostToken),
  }));
}

export async function generateRound(sessionId, hostToken) {
  return handle(await fetch(`/api/sessions/${sessionId}/rounds`, {
    method: 'POST',
    headers: hostHeaders(hostToken),
  }));
}

export async function swapPlayer(sessionId, hostToken, roundId, playerOutId, playerInId) {
  return handle(await fetch(`/api/sessions/${sessionId}/rounds/${roundId}/swap`, {
    method: 'POST',
    headers: hostHeaders(hostToken),
    body: JSON.stringify({ playerOutId, playerInId }),
  }));
}

export async function restorePlayer(sessionId, hostToken, playerId) {
  return handle(await fetch(`/api/sessions/${sessionId}/players/${playerId}/restore`, {
    method: 'POST',
    headers: hostHeaders(hostToken),
  }));
}

export async function deletePlayerPermanent(sessionId, hostToken, playerId) {
  return handle(await fetch(`/api/sessions/${sessionId}/players/${playerId}/permanent`, {
    method: 'DELETE',
    headers: hostHeaders(hostToken),
  }));
}

export async function resetBoard(sessionId, hostToken) {
  return handle(await fetch(`/api/sessions/${sessionId}/reset`, {
    method: 'POST',
    headers: hostHeaders(hostToken),
  }));
}

export async function claimHost(sessionId) {
  return handle(await fetch(`/api/sessions/${sessionId}/claim-host`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }));
}

export async function renameBoard(sessionId, hostToken, name) {
  return handle(await fetch(`/api/sessions/${sessionId}/name`, {
    method: 'PATCH',
    headers: hostHeaders(hostToken),
    body: JSON.stringify({ name }),
  }));
}

export async function updateCourts(sessionId, hostToken, courts) {
  return handle(await fetch(`/api/sessions/${sessionId}/courts`, {
    method: 'PATCH',
    headers: hostHeaders(hostToken),
    body: JSON.stringify({ courts }),
  }));
}
