import React, { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.js';
import CountryFlag from '../components/shared/CountryFlag';
import { BarBreakdown, TrendChart, RingStat } from '../components/shared/Charts';
import './UserDashboard.css';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function UserDashboard() {
  const { user } = useAuth();
  const { countries } = useOutletContext() || { countries: [] };
  const [activeCountryId, setActiveCountryId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    if (!activeCountryId && countries.length > 0) {
      setActiveCountryId(countries[0]._id);
    }
  }, [countries, activeCountryId]);

  const fetchAnalytics = useCallback(async (countryId) => {
    if (!countryId) return;
    setLoadingAnalytics(true);
    try {
      const res = await axios.get(`/applications/stats/country/${countryId}`);
      setAnalytics(res.data.analytics);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load analytics');
      setAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => { if (activeCountryId) fetchAnalytics(activeCountryId); }, [activeCountryId, fetchAnalytics]);

  const activeCountry = countries.find(c => c._id === activeCountryId);
  const conversionRate = analytics && analytics.total > 0
    ? Math.round(((analytics.byOffer?.Received || 0) / analytics.total) * 100)
    : 0;

  return (
    <div className="user-dash animate-fade">
      <div className="ud-welcome">
        <div className="ud-welcome-text">
          <h2>{getGreeting()}, {user?.name || user?.username}!</h2>
          <p>Manage your assigned country applications below.</p>
        </div>
      </div>

      {countries.length === 0 ? (
        <div className="dt-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <p>No countries have been assigned to your account yet. Contact your administrator.</p>
        </div>
      ) : (
        <>
          <div className="ud-countries">
            {countries.map(c => {
              const total = c.total ?? c.count ?? 0;
              const offered = c.offered ?? 0;
              const paid = c.paid ?? 0;
              return (
                <div key={c._id} className="ud-country-card">
                  <div className="ud-cc-top">
                    <span className="ud-cc-flag"><CountryFlag country={c} size={32} rounded={6} /></span>
                    <div className="ud-cc-info">
                      <h3>{c.name}</h3>
                      <p>{total} total application{total !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="ud-cc-stats">
                    <div className="ud-stat">
                      <span style={{ color: 'var(--green)' }}>{offered}</span>
                      <span>Received</span>
                    </div>
                    <div className="ud-stat">
                      <span style={{ color: 'var(--uca-blue, #2563EB)' }}>{paid}</span>
                      <span>Paid</span>
                    </div>
                    <div className="ud-stat">
                      <span style={{ color: 'var(--text-secondary)' }}>{total - offered}</span>
                      <span>Pending</span>
                    </div>
                  </div>
                  <Link to={`/applications/${c._id}`} className="ud-cc-btn">
                    Open Applications
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                </div>
              );
            })}
          </div>

                    <div className="ud-analytics-card">
            <div className="ud-analytics-header">
              <div>
                <h3>Country Analytics</h3>
                <p>What's happening in your assigned countries</p>
              </div>
              {countries.length > 1 && (
                <div className="ud-country-tabs">
                  {countries.map(c => (
                    <button
                      key={c._id}
                      className={`ud-country-tab ${activeCountryId === c._id ? 'active' : ''}`}
                      onClick={() => setActiveCountryId(c._id)}
                    >
                      <CountryFlag country={c} size={16} rounded={2} /> {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingAnalytics ? (
              <div className="dt-loading" style={{ minHeight: 180 }}>
                <div className="dt-spinner" /><p>Loading analytics…</p>
              </div>
            ) : analytics ? (
              <div className="ud-analytics-grid">
                <div className="ud-analytics-block ud-analytics-ring">
                  <RingStat percent={conversionRate} size={88} stroke={9} label="Conversion" />
                  <div className="ud-analytics-ring-meta">
                    <span className="ud-analytics-total">{analytics.total}</span>
                    <span>total applications for {activeCountry?.name}</span>
                  </div>
                </div>
                <div className="ud-analytics-block">
                  <h4>By Level</h4>
                  <BarBreakdown data={analytics.byLevel} defaultColor="var(--uca-blue)" />
                </div>
                <div className="ud-analytics-block">
                  <h4>Offer Status</h4>
                  <BarBreakdown
                    data={analytics.byOffer}
                    colors={{ Received: 'var(--green)', Withdraw: 'var(--red)', 'Not Received': 'var(--yellow)' }}
                  />
                </div>
                <div className="ud-analytics-block ud-analytics-trend">
                  <h4>Submissions — last 6 months</h4>
                  <TrendChart data={analytics.monthly} color="var(--uca-orange)" />
                </div>
              </div>
            ) : (
              <div className="dt-empty"><p>No analytics available yet.</p></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
