import React from 'react';

function PlayerSlot({ player, isHost, onSwap }) {
  if (!isHost) return <span className="player-name">{player.name}</span>;
  return (
    <button className="player-slot-btn" onClick={() => onSwap(player)}>
      {player.name}
    </button>
  );
}

function TeamRow({ players, isHost, onSwap }) {
  return (
    <div className="team-row">
      {players.map((p, i) => (
        <React.Fragment key={p.id}>
          {i > 0 && <span className="team-slash">/</span>}
          <PlayerSlot player={p} isHost={isHost} onSwap={onSwap} />
        </React.Fragment>
      ))}
    </div>
  );
}

export default function CourtCard({ court, isHost, onSwap = () => {} }) {
  return (
    <div className="court-card">
      <div className="court-label">Court {court.courtNumber}</div>

      <div className="team team--1">
        <TeamRow players={court.team1} isHost={isHost} onSwap={onSwap} />
      </div>

      <div className="vs-divider">vs</div>

      <div className="team team--2">
        <TeamRow players={court.team2} isHost={isHost} onSwap={onSwap} />
      </div>
    </div>
  );
}
