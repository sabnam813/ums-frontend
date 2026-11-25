import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as checkIsAdmin, isSuperAdmin } from '../../utils/permissions';
import { sectionLabel } from '../../utils/commission';
import CountryFlag from '../../components/shared/CountryFlag';
import { IconSearch } from '../../utils/exportHelpers';
import './Commission.css';

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

  const [overview, setOverview] = useState([]);
  const [allCountries, setAllCountries] = useState([]);
  const [newCountry, setNewCountry] = useState('');
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
      const ov = await axios.get('/commission/overview');
      setOverview(ov.data.countries || []);
      setAllCountries(ov.data.allCountries || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load intakes');
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
    if (!newCountry) { toast.error('Select a country'); return; }
    if (!name) { toast.error('Enter an intake name'); return; }
    setCreating(true);
    try {
      await axios.post('/commission/intakes', { name, country: newCountry });
      toast.success('Intake created');
      setShowCreate(false);
      setNewName('');
      setNewCountry('');
      fetchIntakes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create intake');
    } finally {
      setCreating(false);
    }
  };

  const goToResult = (r) => {
    navigate(`${base}/${r.intake?._id}/${r.country?._id}/${r.section}`);
  };

  const handleDeleteCountry = async (e, c) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${c.name} from Commission? This permanently removes every intake and record under it, in every section. This cannot be undone.`)) return;
    try {
      await axios.delete(`/commission/countries/${c._id}`);
      toast.success('Country deleted');
      fetchIntakes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete country');
    }
  };

  return (
    <div className="cms-page">
      <div className="cms-page-head">
        <div>
          <h2>Commission</h2>
          <p className="cms-page-sub">Country → Intake → Associate / Shareholder / Department</p>
        </div>
        <button className="cms-btn cms-btn-primary" onClick={() => setShowCreate(true)}>+ Add Country</button>
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
            <p className="cms-muted">Loading countries…</p>
          ) : overview.length === 0 ? (
            <p className="cms-muted">No countries are available to you for Commission.</p>
          ) : (
            overview.map(c => (
              <div key={c._id} className="cms-tile cms-tile-clickable" onClick={() => navigate(`${base}/country/${c._id}`)}>
                {superAdmin && (
                  <button className="cms-tile-delete" title="Delete country" onClick={(e) => handleDeleteCountry(e, c)}>
                    {TrashIconSm}
                  </button>
                )}
                <span className="cms-tile-icon"><CountryFlag country={c} size={28} rounded={5} /></span>
                <span className="cms-tile-label">{c.name}</span>
                <span className="cms-tile-sub">{(c.intakeIds || []).length} intake{(c.intakeIds || []).length === 1 ? '' : 's'}, {c.total} record{c.total === 1 ? '' : 's'}</span>
              </div>
            ))
          )}
        </div>
      )}

      {showCreate && (
        <div className="cms-modal-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()}>
            <h3>Add Country</h3>
            <label className="cms-field">
              <span>Country</span>
              <select value={newCountry} onChange={e => setNewCountry(e.target.value)}>
                <option value="">Select…</option>
                {allCountries.filter(c => !overview.some(o => String(o._id) === String(c._id))).map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </label>
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
