import React, { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import CountryFlag from '../../components/shared/CountryFlag';
import { BarBreakdown, TrendChart, RingStat } from '../../components/shared/Charts';
import './AdminDashboard.css';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const StatIcons = {
  applications: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
    </svg>
  ),
  countries: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  offers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { countries } = useOutletContext() || { countries: [] };
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/applications/stats/overview');
      setStats(res.data.stats);
      setRecentActivity(res.data.recentActivity || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load dashboard stats');
    } finally { setLoading(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await axios.get('/applications/stats/analytics');
      setAnalytics(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load analytics');
    } finally { setLoadingAnalytics(false); }
  }, []);

  useEffect(() => { fetchStats(); fetchAnalytics(); }, [fetchStats, fetchAnalytics]);

  const statCards = stats ? [
    { label: 'Total Applications', value: stats.totalApplications, change: `+${stats.newThisWeek} this week`, iconKey: 'applications', color: 'blue' },
    { label: 'Countries Active', value: stats.countriesActive, change: `${countries.length} total`, iconKey: 'countries', color: 'orange' },
    { label: 'Country Users', value: stats.countryUsers, change: 'Active accounts', iconKey: 'users', color: 'green' },
    { label: 'Offers Received', value: stats.offered, change: `${stats.conversionRate}% conversion`, iconKey: 'offers', color: 'purple' },
  ] : [];

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner"/><p>Loading dashboard…</p></div>
  );

  const overall = analytics?.overall;
  const conversionRate = overall && overall.total > 0
    ? Math.round(((overall.byOffer?.Received || 0) / overall.total) * 100)
    : 0;

  return (
    <div className="dashboard animate-fade">
      <div className="welcome-banner">
        <div className="welcome-text">
          <h2>{getGreeting()}, {user?.name || user?.username}!</h2>
          <p>Here's what's happening across all country applications today.</p>
        </div>
        <div className="welcome-actions">
          <Link to="/admin/applications" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Country
          </Link>
          <Link to="/admin/applications" className="btn btn-secondary">View All Applications</Link>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div className={`stat-card stat-${s.color}`} key={i}>
            <div className="stat-icon">{StatIcons[s.iconKey]}</div>
            <div className="stat-body">
              <span className="stat-label">{s.label}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-change">{s.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="dash-card countries-card">
          <div className="card-header">
            <h3>Country Applications</h3>
            <Link to="/admin/applications" className="card-link">Manage all</Link>
          </div>
          <div className="countries-list">
            {countries.length === 0 ? (
              <div className="dt-empty"><p>No countries yet. Add one from the Applications page.</p></div>
            ) : countries.map(c => {
              const total = c.total ?? c.count ?? 0;
              const offered = c.offered ?? 0;
              return (
                <Link to={`/admin/applications/${c._id}`} className="country-row" key={c._id}>
                  <span className="country-flag-lg"><CountryFlag country={c} size={28} rounded={5} /></span>
                  <div className="country-row-info">
                    <span className="country-row-name">{c.name}</span>
                    <div className="country-row-bar-wrap">
                      <div className="country-row-bar">
                        <div className="bar-offered" style={{ width: total > 0 ? `${(offered / total) * 100}%` : '0%' }}/>
                      </div>
                      <span className="bar-label">{offered}/{total} received</span>
                    </div>
                  </div>
                  <div className="country-row-stats">
                    <span className="tag tag-green">{offered} received</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="dash-card activity-card">
          <div className="card-header">
            <h3>Recent Activity</h3>
            <span className="card-badge">Live</span>
          </div>
          <div className="activity-list">
            {recentActivity.length === 0 ? (
              <div className="dt-empty"><p>No activity yet.</p></div>
            ) : recentActivity.map(a => (
              <div className="activity-item" key={a.id}>
                <div className="activity-dot"/>
                <div className="activity-body">
                  <span className="activity-action">{a.action}</span>
                  <div className="activity-meta">
                    <span>{a.country}</span><span>·</span>
                    <span>{a.user}</span><span>·</span>
                    <span className="activity-time">{timeAgo(a.time)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {stats && (
            <div className="quick-stats">
              <div className="quick-stat">
                <span className="qs-value" style={{ color: 'var(--green)' }}>{stats.offered}</span>
                <span className="qs-label">Received</span>
              </div>
              <div className="quick-stat">
                <span className="qs-value" style={{ color: 'var(--uca-blue)' }}>{stats.paid}</span>
                <span className="qs-label">Paid</span>
              </div>
              <div className="quick-stat">
                <span className="qs-value" style={{ color: 'var(--text-secondary)' }}>{stats.totalApplications}</span>
                <span className="qs-label">Total</span>
              </div>
            </div>
          )}
        </div>
      </div>

            <div className="dash-card analytics-overview-card">
        <div className="card-header">
          <h3>All Countries &amp; Users Analytics</h3>
          <span className="card-badge">System-wide</span>
        </div>

        {loadingAnalytics ? (
          <div className="dt-loading" style={{ minHeight: 180 }}>
            <div className="dt-spinner" /><p>Crunching the numbers…</p>
          </div>
        ) : overall ? (
          <>
            <div className="aov-grid">
              <div className="aov-block aov-ring">
                <RingStat percent={conversionRate} size={88} stroke={9} label="Conversion" />
                <div className="aov-ring-meta">
                  <span className="aov-total">{overall.total}</span>
                  <span>applications across all countries</span>
                </div>
              </div>
              <div className="aov-block">
                <h4>By Level</h4>
                <BarBreakdown data={overall.byLevel} defaultColor="var(--uca-blue)" />
              </div>
              <div className="aov-block">
                <h4>Offer Status</h4>
                <BarBreakdown
                  data={overall.byOffer}
                  colors={{ Received: 'var(--green)', Withdraw: 'var(--red)', 'Not Received': 'var(--yellow)' }}
                />
              </div>
              <div className="aov-block aov-trend">
                <h4>Submissions — last 6 months</h4>
                <TrendChart data={overall.monthly} color="var(--uca-orange)" />
              </div>
            </div>

                        <div className="aov-subsection">
              <h4>By Country</h4>
              <div className="aov-country-table">
                <div className="aov-country-row aov-country-head">
                  <span>Country</span><span>Total</span><span>Received</span><span>Paid</span>
                </div>
                {(analytics.perCountry || []).map(c => (
                  <Link to={`/admin/applications/${c.countryId}`} className="aov-country-row" key={c.countryId}>
                    <span className="aov-country-name">
                      <CountryFlag country={c} size={18} rounded={3} /> {c.name}
                    </span>
                    <span>{c.total}</span>
                    <span className="aov-green">{c.byOffer?.Received || 0}</span>
                    <span className="aov-blue">{c.byPayment?.Complete || 0}</span>
                  </Link>
                ))}
                {(analytics.perCountry || []).length === 0 && (
                  <div className="dt-empty" style={{ padding: 20 }}><p>No countries yet.</p></div>
                )}
              </div>
            </div>

                        <div className="aov-subsection">
              <h4>By User</h4>
              <div className="aov-user-table">
                <div className="aov-user-row aov-user-head">
                  <span>User</span><span>Countries</span><span>Logged</span><span>Status</span>
                </div>
                {(analytics.perUser || []).map(u => (
                  <div className="aov-user-row" key={u.userId}>
                    <span className="aov-user-name">{u.name || u.username}</span>
                    <span>{u.countryCount}</span>
                    <span>{u.applicationsLogged}</span>
                    <span className={`aov-status ${u.status}`}>{u.status}</span>
                  </div>
                ))}
                {(analytics.perUser || []).length === 0 && (
                  <div className="dt-empty" style={{ padding: 20 }}><p>No country users yet.</p></div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="dt-empty"><p>No analytics available yet.</p></div>
        )}
      </div>
    </div>
  );
}
