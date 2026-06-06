import React, { useState, useRef, useEffect } from 'react';
import { addPlayer } from '../api.js';

export default function AddPlayerModal({ sessionId, hostToken, onClose, onError }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastAdded, setLastAdded] = useState('');
  const [fieldError, setFieldError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setFieldError('');
    try {
      await addPlayer(sessionId, hostToken, trimmed);
      setLastAdded(trimmed);
      setName('');
      inputRef.current?.focus();
    } catch (err) {
      setFieldError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add players</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {lastAdded && (
          <p className="added-confirm">✓ Added {lastAdded}</p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="player-name">Player name</label>
            <input
              id="player-name"
              ref={inputRef}
              className={`input${fieldError ? ' input--error' : ''}`}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setFieldError(''); }}
              placeholder="Enter name…"
              maxLength={40}
            />
            {fieldError && <p className="field-error">{fieldError}</p>}
          </div>
          <div className="add-player-actions">
            <button className="btn-primary" type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Adding…' : 'Add'}
            </button>
            <button className="btn-secondary" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
