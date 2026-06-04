import React, { useState } from 'react';
import { createSession } from '../api.js';

export default function HomePage({ navigate }) {
  const [courts, setCourts] = useState(() => parseInt(localStorage.getItem('lastCourtCount')) || 2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const { sessionId, mcToken } = await createSession(courts);
      localStorage.setItem('lastCourtCount', courts);
      localStorage.setItem(`mc_${sessionId}`, mcToken);
      navigate(`/${sessionId}`);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="page-center">
      <div className="home-card">
        <div className="home-logo">🏓</div>
        <h1 className="home-title">Pickleball Matchups</h1>
        <p className="home-subtitle">Smart doubles matchup generator</p>

        <div className="form-group">
          <label className="label" htmlFor="courts">Number of courts</label>
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

        <button className="btn-primary btn-lg" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating…' : 'Create Session'}
        </button>

        <p className="home-hint">
          You'll get a link to share with other players.
        </p>
      </div>
    </div>
  );
}
