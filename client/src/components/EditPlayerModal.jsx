import React, { useState, useRef, useEffect } from 'react';
import { renamePlayer } from '../api.js';

export default function EditPlayerModal({ sessionId, hostToken, player, onClose, onError }) {
  const [name, setName] = useState(player.name);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === player.name) return onClose();
    setLoading(true);
    setFieldError('');
    try {
      await renamePlayer(sessionId, hostToken, player.id, trimmed);
      onClose();
    } catch (err) {
      setFieldError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit player</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="edit-player-name">Name</label>
            <input
              id="edit-player-name"
              ref={inputRef}
              className={`input${fieldError ? ' input--error' : ''}`}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setFieldError(''); }}
              maxLength={40}
            />
            {fieldError && <p className="field-error">{fieldError}</p>}
          </div>
          <div className="add-player-actions">
            <button className="btn-primary" type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
