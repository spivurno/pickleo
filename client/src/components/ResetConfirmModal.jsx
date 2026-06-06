import React from 'react';

export default function ResetConfirmModal({ onConfirm, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Reset board?</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="reset-modal-body">
          This will clear all rounds and match history. Players will be kept. This cannot be undone.
        </p>
        <div className="add-player-actions">
          <button className="btn-danger" onClick={onConfirm}>Reset</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
