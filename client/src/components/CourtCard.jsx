import React from 'react';

function PlayerSlot({ player, isHost, onSwap }) {
  if (!isHost) return <span className="player-name">{player.name}</span>;
  return (
    <button className="player-slot-btn" onClick={() => onSwap(player)}>
      {player.name}
    </button>
  );
}

export default function CourtCard({ court, isHost, onSwap = () => {} }) {
  return (
    <div className="court-card">
      <div className="court-label">Court {court.courtNumber}</div>

      <div className="team team--1">
        {court.team1.map(p => (
          <PlayerSlot key={p.id} player={p} isHost={isHost} onSwap={onSwap} />
        ))}
      </div>

      <div className="vs-divider">vs</div>

      <div className="team team--2">
        {court.team2.map(p => (
          <PlayerSlot key={p.id} player={p} isHost={isHost} onSwap={onSwap} />
        ))}
      </div>
    </div>
  );
}
