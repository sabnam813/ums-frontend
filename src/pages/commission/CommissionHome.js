import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as checkIsAdmin, isSuperAdmin } from '../../utils/permissions';
import { sectionLabel } from '../../utils/commission';
import CountryFlag from '../../components/shared/CountryFlag';
import { IconSearch } from '../../utils/exportHelpers';
import './Commission.css';

const FolderIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

const TrashIconSm = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export default function CommissionHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const admin = checkIsAdmin(user);
  const superAdmin = isSuperAdmin(user);
  const base = admin ? '/admin/commission' : '/commission';

  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const fetchIntakes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/commission/intakes');
      setIntakes(res.data.intakes || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load intakes');
      setIntakes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntakes(); }, [fetchIntakes]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get('/commission/search', { params: { q } });
        setResults(res.data.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { toast.error('Enter an intake name'); return; }
    setCreating(true);
    try {
      const res = await axios.post('/commission/intakes', { name });
      toast.success('Intake created');
      setShowCreate(false);
      setNewName('');
      setIntakes(prev => [res.data.intake, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create intake');
    } finally {
      setCreating(false);
    }
  };

  const goToResult = (r) => {
    navigate(`${base}/${r.intake?._id}/${r.country?._id}/${r.section}`);
  };

  const handleDeleteIntake = async (e, intake) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${intake.name}"? This permanently removes every record under it, in every country and section. This cannot be undone.`)) return;
    try {
      await axios.delete(`/commission/intakes/${intake._id}`);
      toast.success('Intake deleted');
      setIntakes(prev => prev.filter(i => i._id !== intake._id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete intake');
    }
  };

  return (
    <div className="cms-page">
      <div className="cms-page-head">
        <div>
          <h2>Commission</h2>
          <p className="cms-page-sub">Intake → Country → Associate / Shareholder / Department</p>
        </div>
        <button className="cms-btn cms-btn-primary" onClick={() => setShowCreate(true)}>+ New Intake</button>
      </div>

      <div className="cms-searchbar">
        <span className="cms-search-icon"><IconSearch size={15} /></span>
        <input
          type="text"
          placeholder="Search any name (university, college, agent, partner…) across every intake, country and section…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && <button className="cms-search-clear" onClick={() => setQuery('')}>×</button>}
      </div>

      {query.trim() && (
        <div className="cms-search-results">
          {searching ? (
            <p className="cms-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="cms-muted">No matches.</p>
          ) : (
            results.map(r => (
              <button key={`${r.section}-${r._id}`} className="cms-search-result" onClick={() => goToResult(r)}>
                <span className="cms-search-result-main">
                  <strong>{r.university}</strong>
                  <span className="cms-search-result-preview">{r.preview}</span>
                </span>
                <span className="cms-search-result-tags">
                  <span className="cms-tag cms-tag-country">
                    <CountryFlag country={r.country} size={14} /> {r.country?.name}
                  </span>
                  <span className="cms-tag">{r.intake?.name}</span>
                  <span className={`cms-tag cms-tag-${r.section}`}>{sectionLabel(r.section)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {!query.trim() && (
        <div className="cms-tile-grid">
          {loading ? (
            <p className="cms-muted">Loading intakes…</p>
          ) : intakes.length === 0 ? (
            <p className="cms-muted">No intakes yet — create one to get started.</p>
          ) : (
            intakes.map(i => (
              <div key={i._id} className="cms-tile cms-tile-clickable" onClick={() => navigate(`${base}/${i._id}`)}>
                {superAdmin && (
                  <button
                    className="cms-tile-delete"
                    title="Delete intake"
                    onClick={(e) => handleDeleteIntake(e, i)}
                  >
                    {TrashIconSm}
                  </button>
                )}
                <span className="cms-tile-icon">{FolderIcon}</span>
                <span className="cms-tile-label">{i.name}</span>
                <span className="cms-tile-sub">Created {format(new Date(i.createdAt), 'dd MMM yyyy')}</span>
              </div>
            ))
          )}
        </div>
      )}

      {showCreate && (
        <div className="cms-modal-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()}>
            <h3>New Intake</h3>
            <label className="cms-field">
              <span>Intake name</span>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Spring & Fall Intake 2026"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </label>
            <div className="cms-modal-actions">
              <button className="cms-btn cms-btn-ghost" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
              <button className="cms-btn cms-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
