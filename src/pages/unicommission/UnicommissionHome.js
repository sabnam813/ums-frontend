import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/rbac';
import { isAdmin as checkIsAdmin } from '../../utils/permissions';
import CountryFlag from '../../components/shared/CountryFlag';
import { ruleLabel } from './unicommissionColumns';
import '../commission/Commission.css';
import './Unicommission.css';

export default function UnicommissionHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const base = checkIsAdmin(user) ? '/admin/unicommission' : '/unicommission';
  const canSync = hasPermission(user, 'unicommission', 'edit');

  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/unicommission/countries');
      setCountries(res.data.countries || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load countries');
      setCountries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post('/unicommission/sync', {});
      toast.success(`Synced from Applications: ${res.data.created} new, ${res.data.refreshed} refreshed`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q ? countries.filter(c => c.name.toLowerCase().includes(q)) : countries;
  const total = countries.reduce((n, c) => n + c.count, 0);

  return (
    <div className="cms-page">
      <div className="cms-page-head">
        <div>
          <h2>Unicommission</h2>
          <p className="cms-page-sub">
            Visa-granted students and their commission, one table per country. New visa grants in Applications appear here automatically.
            {total > 0 ? ` ${total} record${total === 1 ? '' : 's'} in total.` : ''}
          </p>
        </div>
        {canSync && (
          <div className="cms-page-actions">
            <button className="hb-btn-outline" onClick={handleSync} disabled={syncing} title="Pulls every visa-granted application into Unicommission">
              {syncing ? 'Syncing…' : 'Sync from Applications'}
            </button>
          </div>
        )}
      </div>

      <div className="cms-searchbar cms-searchbar-narrow">
        <input type="text" placeholder="Search countries…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="cms-tile-grid">
        {loading ? (
          <p className="cms-muted">Loading countries…</p>
        ) : filtered.length === 0 ? (
          <p className="cms-muted">{countries.length === 0 ? 'No countries have been added yet.' : 'No countries match your search.'}</p>
        ) : filtered.map(c => (
          <button key={c._id} className="cms-tile" onClick={() => navigate(`${base}/${c._id}`)}>
            <span className="cms-tile-icon"><CountryFlag country={c} size={28} rounded={5} /></span>
            <span className="cms-tile-label">{c.name}</span>
            <span className="cms-tile-sub">{c.count} record{c.count === 1 ? '' : 's'}</span>
            <span className="uc-tile-meta">
              {c.setting.currency || 'No currency'}
              {c.setting.commissionValue != null ? ` · ${ruleLabel(c.setting.commissionType, c.setting.commissionValue, c.setting.currency)}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
