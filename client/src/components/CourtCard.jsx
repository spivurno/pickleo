import React from 'react';

function PlayerSlot({ player, isHost, onSwap }) {
  if (!isHost) return <span className="player-name">{player.name}</span>;
  return (
    <button className="player-slot-btn" onClick={() => onSwap(player)}>
      {player.name}
      <span className="swap-hint">swap</span>
    </button>
  );
}

export default function CourtCard({ court, isHost, onSwap = () => {} }) {
  return (
    <div className="court-card">
      <div className="court-label">Court {court.courtNumber}</div>

      <div className="team team--1">
        <span className="team-label">Team 1</span>
        {court.team1.map(p => (
          <PlayerSlot key={p.id} player={p} isHost={isHost} onSwap={onSwap} />
        ))}
      </div>

      <div className="vs-divider">vs</div>

      <div className="team team--2">
        <span className="team-label">Team 2</span>
        {court.team2.map(p => (
          <PlayerSlot key={p.id} player={p} isHost={isHost} onSwap={onSwap} />
        ))}
      </div>
    </div>
  );
}
