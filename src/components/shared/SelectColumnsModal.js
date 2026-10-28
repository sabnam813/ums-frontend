import React, { useState } from 'react';
import './SelectColumnsModal.css';

export default function SelectColumnsModal({
  columns, initialSelected, title, actionLabel, onConfirm, onClose,
}) {
  const [selected, setSelected] = useState(() => new Set(initialSelected && initialSelected.length ? initialSelected : columns.map(c => c.key)));
  const [remember, setRemember] = useState(true);

  const toggle = (key, required) => {
    if (required) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(columns.map(c => c.key)));
  const unselectAll = () => setSelected(new Set(columns.filter(c => c.required).map(c => c.key)));

  const handleConfirm = () => {
    if (selected.size === 0) return;
    const orderedKeys = columns.filter(c => selected.has(c.key)).map(c => c.key);
    onConfirm(orderedKeys, remember);
  };

  return (
    <div className="sc-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sc-modal animate-fade">
        <div className="sc-header">
          <div className="sc-title-group">
            <div className="sc-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </div>
            <div>
              <h3>{title}</h3>
              <p>Choose the columns to include</p>
            </div>
          </div>
          <button className="sc-close" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="sc-toolbar">
          <span className="sc-selected-count">{selected.size} of {columns.length} selected</span>
          <div className="sc-toolbar-actions">
            <button type="button" className="sc-toolbar-btn" onClick={selectAll}>Select All</button>
            <button type="button" className="sc-toolbar-btn" onClick={unselectAll}>Unselect All</button>
          </div>
        </div>

        <div className="sc-body">
          {columns.map(col => (
            <label key={col.key} className={`sc-option ${selected.has(col.key) ? 'checked' : ''} ${col.required ? 'locked' : ''}`}>
              <input type="checkbox" checked={selected.has(col.key)} onChange={() => toggle(col.key, col.required)} />
              <span className="sc-option-box">
                {selected.has(col.key) && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              {col.label}
            </label>
          ))}
        </div>

        <label className="sc-remember">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          Remember this selection for this session
        </label>

        <div className="sc-footer">
          <button type="button" className="sc-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="sc-confirm" onClick={handleConfirm} disabled={selected.size === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
