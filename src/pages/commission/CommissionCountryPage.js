import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as checkIsAdmin } from '../../utils/permissions';
import { SECTIONS, sectionLabel } from '../../utils/commission';
import CountryFlag from '../../components/shared/CountryFlag';
import './Commission.css';

const SECTION_ICON = {
  associate: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  shareholder: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3v18h18" /><path d="M18.5 8.5 13 14l-3-3-4.5 4.5" />
    </svg>
  ),
  department: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" />
    </svg>
  ),
};

export default function CommissionCountryPage() {
  const { user } = useAuth();
  const { intakeId, countryId } = useParams();
  const navigate = useNavigate();
  const admin = checkIsAdmin(user);
  const base = admin ? '/admin/commission' : '/commission';

  const [country, setCountry] = useState(null);
  const [intakeName, setIntakeName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [countriesRes, intakesRes] = await Promise.all([
        axios.get('/commission/countries', { params: { intake: intakeId } }),
        axios.get('/commission/intakes'),
      ]);
      const found = (countriesRes.data.countries || []).find(c => String(c._id) === String(countryId));
      setCountry(found || null);
      const foundIntake = (intakesRes.data.intakes || []).find(i => i._id === intakeId);
      setIntakeName(foundIntake?.name || '');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load country');
    } finally {
      setLoading(false);
    }
  }, [intakeId, countryId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="cms-page"><p className="cms-muted">Loading…</p></div>;

  if (!country) {
    return (
      <div className="cms-page">
        <p className="cms-muted">This country isn't available to you for Commission.</p>
      </div>
    );
  }

  const visibleSections = SECTIONS.filter(s => country.sections[s].visible);

  return (
    <div className="cms-page">
      <div className="cms-breadcrumb">
        <Link to={base}>Commission</Link> <span>/</span>
        <Link to={`${base}/${intakeId}`}>{intakeName}</Link> <span>/</span>
        <span>{country.name}</span>
      </div>
      <div className="cms-page-head">
        <div>
          <h2 className="cms-heading-with-flag"><CountryFlag country={country} size={24} rounded={4} /> {country.name}</h2>
          <p className="cms-page-sub">{intakeName}</p>
        </div>
      </div>

      <div className="cms-tile-grid">
        {visibleSections.length === 0 ? (
          <p className="cms-muted">You don't have access to any Commission section for this country.</p>
        ) : (
          visibleSections.map(s => (
            <button
              key={s}
              className="cms-tile"
              onClick={() => navigate(`${base}/${intakeId}/${countryId}/${s}`)}
            >
              <span className="cms-tile-icon">{SECTION_ICON[s]}</span>
              <span className="cms-tile-label">{sectionLabel(s)}</span>
              <span className="cms-tile-sub">{country.sections[s].count} record{country.sections[s].count === 1 ? '' : 's'}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
