import React, { useState } from 'react';
import { swapPlayer } from '../api.js';

export default function SwapModal({
  sessionId, hostToken, roundId, playerOut,
  currentRound, allPlayers, onClose, onError,
}) {
  const [loading, setLoading] = useState(false);

  // Build the set of active player IDs in this round
  const activeIds = new Set();
  for (const court of currentRound.courts) {
    for (const p of [...court.team1, ...court.team2]) activeIds.add(p.id);
  }
  const byeIds = new Set(currentRound.byes.map(p => p.id));

  // All swappable players: everyone except the player being swapped out
  const candidates = allPlayers.filter(p => p.id !== playerOut.id);

  async function handleSwap(playerIn) {
    setLoading(true);
    try {
      await swapPlayer(sessionId, hostToken, roundId, playerOut.id, playerIn.id);
      onClose();
    } catch (e) {
      onError(e.message);
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Swap out {playerOut.name}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className="modal-hint">Choose who replaces them in this round:</p>

        {candidates.length === 0 && (
          <p className="muted">No other players available.</p>
        )}

        <div className="swap-list">
          {byeIds.size > 0 && (
            <>
              <p className="swap-group-label">Sitting out (byes)</p>
              {currentRound.byes
                .filter(p => p.id !== playerOut.id)
                .map(p => (
                  <button
                    key={p.id}
                    className="swap-option swap-option--bye"
                    onClick={() => handleSwap(p)}
                    disabled={loading}
                  >
                    {p.name}
                  </button>
                ))}
            </>
          )}

          <p className="swap-group-label">Active players</p>
          {[...currentRound.courts].flatMap(c => [...c.team1, ...c.team2])
            .filter(p => p.id !== playerOut.id)
            .map(p => (
              <button
                key={p.id}
                className="swap-option"
                onClick={() => handleSwap(p)}
                disabled={loading}
              >
                {p.name}
                <span className="swap-court-hint">Court {
                  currentRound.courts.find(c =>
                    [...c.team1, ...c.team2].some(x => x.id === p.id)
                  )?.courtNumber
                }</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
