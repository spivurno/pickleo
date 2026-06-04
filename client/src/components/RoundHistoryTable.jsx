import React from 'react';

export default function RoundHistoryTable({ rounds }) {
  if (!rounds.length) return null;

  const maxCourts = Math.max(...rounds.map(r => r.courts.length));
  const courtNums = Array.from({ length: maxCourts }, (_, i) => i + 1);
  const hasByes = rounds.some(r => r.byes.length > 0);

  return (
    <div className="history-table-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th className="history-th history-th--rnd">Rnd</th>
            {courtNums.map(n => (
              <th key={n} className="history-th">Court {n}</th>
            ))}
            {hasByes && <th className="history-th history-th--byes">Sat out</th>}
          </tr>
        </thead>
        <tbody>
          {rounds.map((round, i) => (
            <tr key={round.id} className={`history-tr${i % 2 === 1 ? ' history-tr--alt' : ''}`}>
              <td className="history-td history-td--rnd">{round.roundNumber}</td>
              {courtNums.map(n => {
                const court = round.courts.find(c => c.courtNumber === n);
                return (
                  <td key={n} className="history-td history-td--court">
                    {court ? (
                      <div className="history-matchup">
                        <span className="history-team">{court.team1.map(p => p.name).join(' & ')}</span>
                        <span className="history-vs">vs</span>
                        <span className="history-team">{court.team2.map(p => p.name).join(' & ')}</span>
                      </div>
                    ) : <span className="history-none">—</span>}
                  </td>
                );
              })}
              {hasByes && (
                <td className="history-td history-td--byes">
                  {round.byes.length > 0
                    ? round.byes.map(p => p.name).join(', ')
                    : <span className="history-none">—</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
