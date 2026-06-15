import React, { useState } from 'react';
import { createSession } from '../api.js';
import { getRecentBoards, removeRecentBoard, relativeTime } from '../recentBoards.js';

export default function HomePage({ navigate }) {
  const [courts, setCourts] = useState(() => parseInt(localStorage.getItem('lastCourtCount')) || 2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentBoards, setRecentBoards] = useState(() => getRecentBoards());

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const { sessionId, hostToken } = await createSession(courts);
      localStorage.setItem('lastCourtCount', courts);
      localStorage.setItem(`host_${sessionId}`, hostToken);
      navigate(`/${sessionId}`);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  function handleRemoveRecent(sessionId) {
    removeRecentBoard(sessionId);
    setRecentBoards(getRecentBoards());
  }

  return (
    <div className="page-center">
      <div className="home-card">
        <div className="home-logo">🏓</div>
        <h1 className="home-title">Pickleo</h1>
        <p className="home-subtitle">Free pickleball matchup generator</p>

        <div className="form-group">
          <label className="label" htmlFor="courts">How many courts are available?</label>
          <div className="court-stepper">
            <button
              className="stepper-btn"
              onClick={() => setCourts(c => Math.max(1, c - 1))}
              aria-label="Decrease courts"
            >−</button>
            <span className="stepper-value">{courts}</span>
            <button
              className="stepper-btn"
              onClick={() => setCourts(c => c + 1)}
              aria-label="Increase courts"
            >+</button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn-primary btn-lg btn-full" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating…' : 'Create Board'}
        </button>

        <p className="home-hint">
          Share the link — your board persists across games.
        </p>

        {recentBoards.length > 0 && (
          <div className="recent-boards">
            <p className="recent-boards__label">Recent Boards</p>
            <ul className="recent-list">
              {recentBoards.map(b => (
                <li key={b.sessionId} className="recent-item">
                  <button
                    className="recent-link"
                    onClick={() => navigate(`/${b.sessionId}`)}
                  >
                    {b.name
                      ? <span className="recent-name">{b.name}</span>
                      : <span className="recent-id">/{b.sessionId}</span>
                    }
                    <span className="recent-meta">{b.courts} {b.courts === 1 ? 'court' : 'courts'} · {relativeTime(b.visitedAt)}</span>
                  </button>
                  <button
                    className="recent-remove btn-ghost"
                    onClick={() => handleRemoveRecent(b.sessionId)}
                    aria-label="Remove from recent boards"
                  >×</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
