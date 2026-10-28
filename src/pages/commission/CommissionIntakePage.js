import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as checkIsAdmin } from '../../utils/permissions';
import CountryFlag from '../../components/shared/CountryFlag';
import './Commission.css';

export default function CommissionIntakePage() {
  const { user } = useAuth();
  const { intakeId } = useParams();
  const navigate = useNavigate();
  const admin = checkIsAdmin(user);
  const base = admin ? '/admin/commission' : '/commission';

  const [countries, setCountries] = useState([]);
  const [intakeName, setIntakeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [countriesRes, intakesRes] = await Promise.all([
        axios.get('/commission/countries', { params: { intake: intakeId } }),
        axios.get('/commission/intakes'),
      ]);
      setCountries(countriesRes.data.countries || []);
      const found = (intakesRes.data.intakes || []).find(i => i._id === intakeId);
      setIntakeName(found?.name || '');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load countries');
      setCountries([]);
    } finally {
      setLoading(false);
    }
  }, [intakeId]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? countries.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : countries;

  return (
    <div className="cms-page">
      <div className="cms-breadcrumb">
        <Link to={base}>Commission</Link> <span>/</span> <span>{intakeName || '…'}</span>
      </div>
      <div className="cms-page-head">
        <div>
          <h2>{intakeName || 'Intake'}</h2>
          <p className="cms-page-sub">Choose a country</p>
        </div>
      </div>

      <div className="cms-searchbar cms-searchbar-narrow">
        <input
          type="text"
          placeholder="Search countries…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="cms-tile-grid">
        {loading ? (
          <p className="cms-muted">Loading countries…</p>
        ) : filtered.length === 0 ? (
          <p className="cms-muted">
            {countries.length === 0
              ? "No countries are available to you for Commission — ask an admin to grant access."
              : 'No countries match your search.'}
          </p>
        ) : (
          filtered.map(c => {
            const totalCount = ['associate', 'shareholder', 'department'].reduce((n, k) => n + (c.sections[k].visible ? c.sections[k].count : 0), 0);
            return (
              <button key={c._id} className="cms-tile" onClick={() => navigate(`${base}/${intakeId}/${c._id}`)}>
                <span className="cms-tile-icon"><CountryFlag country={c} size={28} rounded={5} /></span>
                <span className="cms-tile-label">{c.name}</span>
                <span className="cms-tile-sub">{totalCount} record{totalCount === 1 ? '' : 's'}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
