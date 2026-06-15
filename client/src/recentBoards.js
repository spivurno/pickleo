const KEY = 'recentBoards';
const MAX = 5;

export function getRecentBoards() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function addRecentBoard(sessionId, courts, name) {
  const prev = getRecentBoards().find(b => b.sessionId === sessionId);
  const boards = getRecentBoards().filter(b => b.sessionId !== sessionId);
  boards.unshift({ sessionId, courts, name: name || prev?.name || null, visitedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(boards.slice(0, MAX)));
}

export function removeRecentBoard(sessionId) {
  const boards = getRecentBoards().filter(b => b.sessionId !== sessionId);
  localStorage.setItem(KEY, JSON.stringify(boards));
}

export function updateRecentBoardName(sessionId, name) {
  const boards = getRecentBoards().map(b =>
    b.sessionId === sessionId ? { ...b, name: name || null } : b
  );
  localStorage.setItem(KEY, JSON.stringify(boards));
}

export function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
