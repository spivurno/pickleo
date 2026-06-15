import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSession, generateRound, addPlayer, removePlayer, updateCourts, claimHost, resetBoard, restorePlayer, deletePlayerPermanent, renameBoard } from '../api.js';
import { useSocket } from '../useSocket.js';
import { addRecentBoard, updateRecentBoardName } from '../recentBoards.js';
import CourtCard from '../components/CourtCard.jsx';
import SwapModal from '../components/SwapModal.jsx';
import AddPlayerModal from '../components/AddPlayerModal.jsx';
import EditPlayerModal from '../components/EditPlayerModal.jsx';
import ResetConfirmModal from '../components/ResetConfirmModal.jsx';
import AdjustCourtsModal from '../components/AdjustCourtsModal.jsx';
import RoundHistoryTable from '../components/RoundHistoryTable.jsx';

export default function SessionPage({ sessionId, navigate }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [swapTarget, setSwapTarget] = useState(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardNameInput, setBoardNameInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAdjustCourts, setShowAdjustCourts] = useState(false);
  const menuRef = useRef(null);
  const addPlayerBtnRef = useRef(null);

  const [hostToken, setHostToken] = useState(() =>
    localStorage.getItem(`host_${sessionId}`) || localStorage.getItem(`mc_${sessionId}`)
  );
  const [myHostVersion, setMyHostVersion] = useState(() => {
    const v = localStorage.getItem(`host_version_${sessionId}`);
    return v !== null ? Number(v) : null;
  });
  // Ref so the WebSocket callback always sees the current value (avoids stale closure)
  const myHostVersionRef = useRef(myHostVersion);
  myHostVersionRef.current = myHostVersion;

  const isHost = Boolean(hostToken);

  // Initial load — also seeds myHostVersion for original session creators who never went through handleClaim
  useEffect(() => {
    getSession(sessionId).then(data => {
      if (!data) setError('Board not found or expired.');
      else {
        setSession(data);
        addRecentBoard(sessionId, data.courts, data.name);
        const hasToken = localStorage.getItem(`host_${sessionId}`) || localStorage.getItem(`mc_${sessionId}`);
        const storedVersion = localStorage.getItem(`host_version_${sessionId}`);
        if (hasToken && storedVersion === null) {
          const v = data.hostVersion ?? 0;
          localStorage.setItem(`host_version_${sessionId}`, String(v));
          setMyHostVersion(v);
          myHostVersionRef.current = v;
        }
      }
      setLoading(false);
    });
  }, [sessionId]);

  // Real-time updates
  const connected = useSocket(sessionId, useCallback(msg => {
    if (msg.type === 'state') {
      setSession(msg.data);
      const serverVersion = msg.data.hostVersion ?? 0;
      const myVersion = myHostVersionRef.current ?? 0;
      const hasToken = localStorage.getItem(`host_${sessionId}`) || localStorage.getItem(`mc_${sessionId}`);
      if (hasToken && serverVersion !== myVersion) {
        localStorage.removeItem(`host_${sessionId}`);
        localStorage.removeItem(`mc_${sessionId}`);
        localStorage.removeItem(`host_version_${sessionId}`);
        setHostToken(null);
        setMyHostVersion(null);
        myHostVersionRef.current = null;
      }
    }
  }, [sessionId]));

  async function handleGenerate() {
    setGenerating(true);
    setActionError('');
    try {
      await generateRound(sessionId, hostToken);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRemovePlayer(playerId) {
    try {
      await removePlayer(sessionId, hostToken, playerId);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function handleRestorePlayer(playerId) {
    try {
      await restorePlayer(sessionId, hostToken, playerId);
    } catch (e) {
      setActionError(e.message);
    }
  }

  function handleDeletePlayer(player) {
    if (pendingDelete) clearTimeout(pendingDelete.timeoutId);
    const timeoutId = setTimeout(async () => {
      try {
        await deletePlayerPermanent(sessionId, hostToken, player.id);
      } catch (e) {
        setActionError(e.message);
      } finally {
        setPendingDelete(null);
      }
    }, 5000);
    setPendingDelete({ id: player.id, name: player.name, timeoutId });
  }

  function handleUndoDelete() {
    if (pendingDelete) clearTimeout(pendingDelete.timeoutId);
    setPendingDelete(null);
  }

  async function handleReset() {
    try {
      await resetBoard(sessionId, hostToken);
      setConfirmReset(false);
    } catch (e) {
      setActionError(e.message);
      setConfirmReset(false);
    }
  }

  async function handleCourtsChange(delta) {
    const next = Math.max(1, (session?.courts ?? 1) + delta);
    try {
      localStorage.setItem('lastCourtCount', next);
      await updateCourts(sessionId, hostToken, next);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function handleClaim() {
    try {
      const { hostToken: newToken, hostVersion: newVersion } = await claimHost(sessionId);
      localStorage.setItem(`host_${sessionId}`, newToken);
      localStorage.setItem(`host_version_${sessionId}`, String(newVersion));
      myHostVersionRef.current = newVersion;
      setHostToken(newToken);
      setMyHostVersion(newVersion);
    } catch (e) {
      setActionError(e.message);
    }
  }

  function startEditBoardName() {
    setBoardNameInput(session?.name || '');
    setEditingBoardName(true);
  }

  function cancelEditBoardName() {
    setEditingBoardName(false);
    setBoardNameInput('');
  }

  async function handleRenameBoardSubmit() {
    const trimmed = boardNameInput.trim().slice(0, 60);
    setEditingBoardName(false);
    setBoardNameInput('');
    if (trimmed === (session?.name || '')) return;
    try {
      await renameBoard(sessionId, hostToken, trimmed);
      updateRecentBoardName(sessionId, trimmed || null);
    } catch (e) {
      setActionError(e.message);
    }
  }

  // Restore focus to "Add player" button when modal closes
  useEffect(() => {
    if (!showAddPlayer) addPlayerBtnRef.current?.focus();
  }, [showAddPlayer]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => () => { if (pendingDelete) clearTimeout(pendingDelete.timeoutId); }, [pendingDelete]);

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

  const { players, archivedPlayers = [], currentRound, rounds, courts, totalRounds } = session;
  const roundNumber = currentRound?.roundNumber ?? 0;
  const canGenerate = players.length >= 4;

  return (
    <div className="session-page">
      {/* Header */}
      <header className="session-header">
        <div className="header-left">
          <span className="header-logo">🏓</span>
          <div>
            {editingBoardName ? (
              <input
                className="board-name-input"
                value={boardNameInput}
                maxLength={60}
                autoFocus
                placeholder="Board name"
                onChange={e => setBoardNameInput(e.target.value)}
                onBlur={handleRenameBoardSubmit}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') cancelEditBoardName();
                }}
              />
            ) : isHost ? (
              <button className="board-name-btn" onClick={startEditBoardName} title="Click to rename">
                {session.name || <span className="board-name-unnamed">Unnamed Board</span>}
              </button>
            ) : (
              <h1 className="header-title">{session.name || <span className="board-name-unnamed">Unnamed Board</span>}</h1>
            )}
            {totalRounds > 0 && <p className="rounds-played">{totalRounds} total rounds</p>}
          </div>
        </div>
        <div className="header-right">
          <span className={`conn-dot ${connected ? 'conn-dot--on' : 'conn-dot--off'}`} title={connected ? 'Live' : 'Reconnecting…'} />
          <div className="header-menu-wrap" ref={menuRef}>
            <button
              className="btn-ghost btn-sm hamburger-btn"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <span className="hamburger-icon" />
            </button>
            {menuOpen && (
              <div className="header-menu">
                <button className="header-menu-item" onClick={() => { copyLink(); setMenuOpen(false); }}>
                  {copied ? '✓ Copied' : 'Share link'}
                </button>
                <button className="header-menu-item" onClick={() => { setMenuOpen(false); navigate('/'); }}>
                  New board
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {isHost && (
        <div className="host-banner">
          <span className="host-badge">You are the host</span>
          <div className="host-banner-right">
            <button className="btn-ghost btn-sm" onClick={() => setShowAdjustCourts(true)}>
              Adjust Courts
            </button>
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
        {currentRound && (
          <div className="round-header">
            <span className="round-label">Round {roundNumber}</span>
          </div>
        )}
        {currentRound ? (
          <>
            <div className="courts-grid">
              {currentRound.courts.map(court => (
                <CourtCard
                  key={court.id}
                  court={court}
                  isHost={isHost}
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

      {/* Host action */}
      {isHost && (
        <div className="section section--action">
          <button
            className="btn-primary btn-lg btn-full"
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
          >
            {generating ? 'Generating…' : currentRound ? 'Generate Next Round' : 'Generate Round 1'}
          </button>
          {rounds.length > 0 && (
            <button className="reset-board-btn" onClick={() => setConfirmReset(true)}>
              New Session
            </button>
          )}
        </div>
      )}

      {/* Round history */}
      {rounds.length > 1 && (
        <div className="section">
          <button
            className="history-toggle"
            onClick={() => setHistoryOpen(o => !o)}
            aria-expanded={historyOpen}
          >
            <span className={`history-toggle__chevron${historyOpen ? ' history-toggle__chevron--open' : ''}`}>›</span>
            Previous rounds
            <span className="history-toggle__count">{rounds.length - 1}</span>
          </button>
          {historyOpen && (
            <div className="history-table-container">
              <RoundHistoryTable rounds={[...rounds].slice(0, -1).reverse()} />
            </div>
          )}
        </div>
      )}

      {/* Players */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Players ({players.length})</h2>
          {isHost && (
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
          {players.length === 0 && (
            <div className="player-row player-row--empty">
              <span className="muted">No active players</span>
            </div>
          )}
          {players.map(p => (
            <div key={p.id} className="player-row">
              <span>{p.name}</span>
              {isHost && (
                <div className="player-actions">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setEditingPlayer(p)}
                  >Edit</button>
                  <button
                    className="btn-ghost btn-sm danger"
                    onClick={() => handleRemovePlayer(p.id)}
                  >Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isHost && (archivedPlayers.length > 0 || pendingDelete) && (
          <div className="past-players">
            <p className="past-players__label">Past players</p>
            {pendingDelete && (
              <div className="delete-undo-bar">
                <span>{pendingDelete.name} deleted.</span>
                <button className="delete-undo-btn" onClick={handleUndoDelete}>Undo</button>
              </div>
            )}
            <div className="player-list">
              {archivedPlayers.filter(p => p.id !== pendingDelete?.id).map(p => (
                <div key={p.id} className="player-row">
                  <span className="past-player-name">{p.name}</span>
                  <div className="player-actions">
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => handleRestorePlayer(p.id)}
                    >Add Back</button>
                    <button
                      className="btn-ghost btn-sm danger"
                      onClick={() => handleDeletePlayer(p)}
                    >Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {swapTarget && (
        <SwapModal
          sessionId={sessionId}
          hostToken={hostToken}
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
          hostToken={hostToken}
          onClose={() => setShowAddPlayer(false)}
          onError={setActionError}
        />
      )}

      {confirmReset && (
        <ResetConfirmModal
          onConfirm={handleReset}
          onClose={() => setConfirmReset(false)}
        />
      )}

      {showAdjustCourts && (
        <AdjustCourtsModal
          courts={courts}
          onAdjust={handleCourtsChange}
          onClose={() => setShowAdjustCourts(false)}
        />
      )}

      {editingPlayer && (
        <EditPlayerModal
          sessionId={sessionId}
          hostToken={hostToken}
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onError={setActionError}
        />
      )}

      <div className="claim-host-bar">
        {isHost ? (
          <span className="claim-host-note">You are the host</span>
        ) : (
          <button className="claim-host-btn" onClick={handleClaim}>
            Claim host role
          </button>
        )}
      </div>
    </div>
  );
}
