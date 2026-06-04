import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSession, generateRound, addPlayer, removePlayer, renamePlayer, updateCourts } from '../api.js';
import { useSocket } from '../useSocket.js';
import CourtCard from '../components/CourtCard.jsx';
import SwapModal from '../components/SwapModal.jsx';
import AddPlayerModal from '../components/AddPlayerModal.jsx';

export default function SessionPage({ sessionId, navigate }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [swapTarget, setSwapTarget] = useState(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const addPlayerBtnRef = useRef(null);

  const mcToken = localStorage.getItem(`mc_${sessionId}`);
  const isMC = Boolean(mcToken);

  // Initial load
  useEffect(() => {
    getSession(sessionId).then(data => {
      if (!data) setError('Session not found or expired.');
      else setSession(data);
      setLoading(false);
    });
  }, [sessionId]);

  // Real-time updates
  const connected = useSocket(sessionId, useCallback(msg => {
    if (msg.type === 'state') setSession(msg.data);
  }, []));

  async function handleGenerate() {
    setGenerating(true);
    setActionError('');
    try {
      await generateRound(sessionId, mcToken);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRemovePlayer(playerId) {
    try {
      await removePlayer(sessionId, mcToken, playerId);
    } catch (e) {
      setActionError(e.message);
    }
  }

  function startEdit(player) {
    setEditingPlayerId(player.id);
    setEditingName(player.name);
  }

  function cancelEdit() {
    setEditingPlayerId(null);
    setEditingName('');
  }

  async function handleRename(playerId) {
    const trimmed = editingName.trim();
    if (!trimmed) return cancelEdit();
    try {
      await renamePlayer(sessionId, mcToken, playerId, trimmed);
    } catch (e) {
      setActionError(e.message);
    } finally {
      cancelEdit();
    }
  }

  async function handleCourtsChange(delta) {
    const next = Math.max(1, (session?.courts ?? 1) + delta);
    try {
      localStorage.setItem('lastCourtCount', next);
      await updateCourts(sessionId, mcToken, next);
    } catch (e) {
      setActionError(e.message);
    }
  }

  // Restore focus to "Add player" button when modal closes
  useEffect(() => {
    if (!showAddPlayer) addPlayerBtnRef.current?.focus();
  }, [showAddPlayer]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <div className="page-center"><p className="muted">Loading…</p></div>;
  if (error) return (
    <div className="page-center">
      <div className="home-card">
        <p className="error-text">{error}</p>
        <button className="btn-secondary" onClick={() => navigate('/')}>Go home</button>
      </div>
    </div>
  );

  const { players, currentRound, rounds, courts } = session;
  const roundNumber = currentRound?.roundNumber ?? 0;
  const canGenerate = players.length >= 4;

  return (
    <div className="session-page">
      {/* Header */}
      <header className="session-header">
        <div className="header-left">
          <span className="header-logo">🏓</span>
          <div>
            <h1 className="header-title">Pickleball</h1>
            {roundNumber > 0 && <p className="header-sub">Round {roundNumber}</p>}
          </div>
        </div>
        <div className="header-right">
          <span className={`conn-dot ${connected ? 'conn-dot--on' : 'conn-dot--off'}`} title={connected ? 'Live' : 'Reconnecting…'} />
          <button className="btn-ghost btn-sm" onClick={copyLink}>
            {copied ? '✓ Copied' : 'Share link'}
          </button>
        </div>
      </header>

      {isMC && (
        <div className="mc-banner">
          <span className="mc-badge">You are the MC</span>
          <div className="court-control">
            <span className="label">Courts</span>
            <button className="stepper-btn stepper-btn--sm" onClick={() => handleCourtsChange(-1)}>−</button>
            <span className="stepper-value stepper-value--sm">{courts}</span>
            <button className="stepper-btn stepper-btn--sm" onClick={() => handleCourtsChange(1)}>+</button>
          </div>
        </div>
      )}

      {actionError && (
        <div className="action-error" onClick={() => setActionError('')}>
          {actionError} <span className="dismiss">✕</span>
        </div>
      )}

      {/* Current round */}
      <div className="section">
        {currentRound ? (
          <>
            <div className="courts-grid">
              {currentRound.courts.map(court => (
                <CourtCard
                  key={court.id}
                  court={court}
                  isMC={isMC}
                  onSwap={player => setSwapTarget({ roundId: currentRound.id, player })}
                />
              ))}
            </div>

            {currentRound.byes.length > 0 && (
              <div className="byes-row">
                <span className="byes-label">Sitting out:</span>
                {currentRound.byes.map(p => (
                  <span key={p.id} className="bye-chip">{p.name}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty-round">
            <p className="empty-round__text">
              {canGenerate
                ? 'Ready to start. Generate the first round when everyone is here.'
                : 'Add at least 4 players to generate matchups.'}
            </p>
          </div>
        )}
      </div>

      {/* MC action */}
      {isMC && (
        <div className="section section--action">
          <button
            className="btn-primary btn-lg btn-full"
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
          >
            {generating ? 'Generating…' : currentRound ? 'Generate Next Round' : 'Generate Round 1'}
          </button>
        </div>
      )}

      {/* Round history */}
      {rounds.length > 1 && (
        <div className="section">
          <h2 className="section-title">Previous rounds</h2>
          {[...rounds].reverse().slice(1).map(round => (
            <details key={round.id} className="history-round">
              <summary className="history-summary">Round {round.roundNumber}</summary>
              <div className="history-courts">
                {round.courts.map(court => (
                  <CourtCard key={court.id} court={court} isMC={false} />
                ))}
                {round.byes.length > 0 && (
                  <div className="byes-row">
                    <span className="byes-label">Sat out:</span>
                    {round.byes.map(p => <span key={p.id} className="bye-chip">{p.name}</span>)}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Players */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Players ({players.length})</h2>
          {isMC && (
            <button
              ref={addPlayerBtnRef}
              className="btn-secondary btn-sm"
              onClick={() => setShowAddPlayer(true)}
            >
              + Add player
            </button>
          )}
        </div>
        <div className="player-list">
          {players.map(p => (
            <div key={p.id} className="player-row">
              {editingPlayerId === p.id ? (
                <form
                  className="player-edit-form"
                  onSubmit={e => { e.preventDefault(); handleRename(p.id); }}
                >
                  <input
                    className="input player-edit-input"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                    maxLength={40}
                    autoFocus
                  />
                  <button className="btn-ghost btn-sm" type="submit" aria-label="Save">✓</button>
                  <button className="btn-ghost btn-sm" type="button" onClick={cancelEdit} aria-label="Cancel">✕</button>
                </form>
              ) : (
                <>
                  <span>{p.name}</span>
                  {isMC && (
                    <div className="player-actions">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => startEdit(p)}
                        aria-label={`Rename ${p.name}`}
                      >✎</button>
                      <button
                        className="btn-ghost btn-sm danger"
                        onClick={() => handleRemovePlayer(p.id)}
                        aria-label={`Remove ${p.name}`}
                      >✕</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {swapTarget && (
        <SwapModal
          sessionId={sessionId}
          mcToken={mcToken}
          roundId={swapTarget.roundId}
          playerOut={swapTarget.player}
          currentRound={currentRound}
          allPlayers={players}
          onClose={() => setSwapTarget(null)}
          onError={setActionError}
        />
      )}

      {showAddPlayer && (
        <AddPlayerModal
          sessionId={sessionId}
          mcToken={mcToken}
          onClose={() => setShowAddPlayer(false)}
          onError={setActionError}
        />
      )}
    </div>
  );
}
