import React, { useState, useMemo } from 'react';
import './AssociateSearchModal.css';

export default function AssociateSearchModal({ associates = [], value = '', onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const cleanAssociates = useMemo(
    () => [...new Set(associates.filter(a => a && a.trim()))].sort((a, b) => a.localeCompare(b)),
    [associates]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cleanAssociates;
    return cleanAssociates.filter(a => a.toLowerCase().includes(q));
  }, [cleanAssociates, query]);

  const handlePick = (name) => {
    onSelect(name);
    onClose();
  };

  const handleClear = () => {
    onSelect('');
    onClose();
  };

  return (
    <div className="as-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="as-modal animate-fade">
        <div className="as-header">
          <div className="as-title-group">
            <div className="as-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <circle cx="11" cy="11" r="8" transform="translate(9 8) scale(0.5)" />
              </svg>
            </div>
            <div>
              <h3>Associate Search</h3>
              <p>Find and filter records by referring associate</p>
            </div>
          </div>
          <button className="as-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="as-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            autoFocus
            type="text"
            placeholder="Type an associate's name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="as-search-input"
          />
          {query && (
            <button className="as-clear-input" onClick={() => setQuery('')} title="Clear search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="as-body">
          {filtered.length === 0 ? (
            <div className="as-empty">
              {cleanAssociates.length === 0
                ? 'No associates found in the current records yet.'
                : 'No associates match your search.'}
            </div>
          ) : (
            filtered.map(name => (
              <button
                key={name}
                className={`as-option ${value === name ? 'selected' : ''}`}
                onClick={() => handlePick(name)}
              >
                <span className="as-option-avatar">{name.charAt(0).toUpperCase()}</span>
                <span className="as-option-name">{name}</span>
                {value === name && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>

        <div className="as-footer">
          <button className="as-cancel" onClick={handleClear} disabled={!value}>
            Clear selection
          </button>
          <button className="as-confirm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
