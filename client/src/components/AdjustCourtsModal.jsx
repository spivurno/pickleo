import React from 'react';

export default function AdjustCourtsModal({ courts, onAdjust, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Adjust Courts</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="court-stepper">
          <button className="stepper-btn" onClick={() => onAdjust(-1)} aria-label="Decrease courts">−</button>
          <span className="stepper-value">{courts}</span>
          <button className="stepper-btn" onClick={() => onAdjust(1)} aria-label="Increase courts">+</button>
        </div>
      </div>
    </div>
  );
}
