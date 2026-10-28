import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './GlobalSearch.css';

const TYPE_META = {
  application: { label: 'Application', color: '#2E4F8F' },
  inquiry: { label: 'Inquiry', color: '#F08641' },
  contact: { label: 'Contact', color: '#6B5B95' },
};

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const wrapRef = useRef();
  const debounceRef = useRef();
  const navigate = useNavigate();

  const runSearch = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get('/search', { params: { q: q.trim() } });
        setResults(res.data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    runSearch(query);
  }, [query, runSearch]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (result) => {
    setOpen(false);
    setPreview(result);
  };

  const handleOpen = () => {
    if (!preview) return;
    navigate(preview.openPath);
    setPreview(null);
    setQuery('');
    setResults([]);
  };

  return (
    <>
      <div className="gs-wrap" ref={wrapRef}>
        <div className={`gs-input-box ${open ? 'gs-focused' : ''}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search students, providers, referrals…"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {query && (
            <button className="gs-clear" onClick={() => { setQuery(''); setResults([]); }} aria-label="Clear search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {open && query.trim().length >= 2 && (
          <div className="gs-dropdown">
            {loading ? (
              <div className="gs-status">Searching…</div>
            ) : results.length === 0 ? (
              <div className="gs-status">No matches found</div>
            ) : (
              results.map(r => (
                <button key={`${r.type}-${r.id}`} className="gs-result" onClick={() => handleSelect(r)}>
                  <span className="gs-result-type" style={{ background: TYPE_META[r.type]?.color }}>
                    {TYPE_META[r.type]?.label}
                  </span>
                  <span className="gs-result-text">
                    <span className="gs-result-title">{r.title}</span>
                    {r.subtitle && <span className="gs-result-subtitle">{r.subtitle}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {preview && (
        <div className="gs-preview-overlay" onClick={() => setPreview(null)}>
          <div className="gs-preview-card" onClick={e => e.stopPropagation()}>
            <div className="gs-preview-header" style={{ background: TYPE_META[preview.type]?.color }}>
              <span className="gs-preview-type">{TYPE_META[preview.type]?.label}</span>
              <button className="gs-preview-close" onClick={() => setPreview(null)} aria-label="Close">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="gs-preview-body">
              <h3>{preview.title}</h3>
              <dl className="gs-preview-details">
                {Object.entries(preview.details || {}).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </React.Fragment>
                ))}
              </dl>
              <button className="gs-preview-open-btn" onClick={handleOpen}>
                Open Record
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
