import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as checkIsAdmin, isSuperAdmin } from '../../utils/permissions';
import CountryFlag from '../../components/shared/CountryFlag';
import './Commission.css';

const FolderIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

export default function CommissionCountryIntakes() {
  const { user } = useAuth();
  const { countryId } = useParams();
  const navigate = useNavigate();
  const admin = checkIsAdmin(user);
  const superAdmin = isSuperAdmin(user);
  const base = admin ? '/admin/commission' : '/commission';

  const [country, setCountry] = useState(null);
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/commission/overview');
      const found = (res.data.countries || []).find(c => String(c._id) === String(countryId));
      setCountry(found || null);
      const ids = new Set((found?.intakeIds || []).map(String));
      setIntakes((res.data.intakes || []).filter(i => ids.has(String(i._id))));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load intakes');
    } finally {
      setLoading(false);
    }
  }, [countryId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { toast.error('Enter an intake name'); return; }
    setCreating(true);
    try {
      await axios.post('/commission/intakes', { name, country: countryId });
      toast.success('Intake created');
      setShowCreate(false);
      setNewName('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create intake');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, intake) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${intake.name}" for ${country.name}? This permanently removes every record under it for this country. This cannot be undone.`)) return;
    try {
      await axios.delete(`/commission/intakes/${intake._id}`, { params: { country: countryId } });
      toast.success('Intake deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete intake');
    }
  };

  if (loading) return <div className="cms-page"><p className="cms-muted">Loading…</p></div>;

  if (!country) {
    return (
      <div className="cms-page">
        <p className="cms-muted">This country isn't available to you for Commission.</p>
      </div>
    );
  }

  const filtered = search.trim()
    ? intakes.filter(i => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : intakes;

  return (
    <div className="cms-page">
      <div className="cms-breadcrumb">
        <Link to={base}>Commission</Link> <span>/</span> <span>{country.name}</span>
      </div>
      <div className="cms-page-head">
        <div>
          <h2 className="cms-heading-with-flag"><CountryFlag country={country} size={24} rounded={4} /> {country.name}</h2>
          <p className="cms-page-sub">Choose an intake</p>
        </div>
        <button className="cms-btn cms-btn-primary" onClick={() => setShowCreate(true)}>+ New Intake</button>
      </div>

      <div className="cms-searchbar cms-searchbar-narrow">
        <input type="text" placeholder="Search intakes…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="cms-tile-grid">
        {filtered.length === 0 ? (
          <p className="cms-muted">No intakes yet.</p>
        ) : (
          filtered.map(i => {
            const n = country.counts?.[i._id] || 0;
            return (
              <div
                key={i._id}
                className="cms-tile cms-tile-clickable"
                onClick={() => navigate(`${base}/${i._id}/${countryId}`)}
              >
                {superAdmin && (
                  <button className="cms-tile-delete" title="Delete intake" onClick={(e) => handleDelete(e, i)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                )}
                <span className="cms-tile-icon">{FolderIcon}</span>
                <span className="cms-tile-label">{i.name}</span>
                <span className="cms-tile-sub">{n} record{n === 1 ? '' : 's'}, created {format(new Date(i.createdAt), 'dd MMM yyyy')}</span>
              </div>
            );
          })
        )}
      </div>

      {showCreate && (
        <div className="cms-modal-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="cms-modal" onClick={e => e.stopPropagation()}>
            <h3>New Intake</h3>
            <label className="cms-field">
              <span>Intake name</span>
              <input
                type="text"
                autoFocus
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
