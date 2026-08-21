import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './SuperAdminLayout.css';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/superadmin', label: 'Infrastructure Dashboard', end: true, icon: 'grid' },
    ],
  },
  {
    title: 'Trash & Backup',
    items: [
      { to: '/superadmin/trash', label: 'Trash', icon: 'trash' },
      { to: '/superadmin/backup', label: 'Backup & Restore', icon: 'save' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { to: '/superadmin/database', label: 'Database Management', icon: 'db' },
      { to: '/superadmin/logs', label: 'System Logs', icon: 'file' },
      { to: '/superadmin/errors', label: 'Crash & Error Monitoring', icon: 'alert' },
      { to: '/superadmin/performance', label: 'Performance Monitoring', icon: 'activity' },
      { to: '/superadmin/api-management', label: 'API Management', icon: 'server' },
    ],
  },
  {
    title: 'Security & Audit',
    items: [
      { to: '/superadmin/security', label: 'Security Center', icon: 'shield' },
      { to: '/superadmin/audit', label: 'Audit Center', icon: 'list' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/superadmin/jobs', label: 'Background Jobs', icon: 'clock' },
      { to: '/superadmin/cache', label: 'Cache Management', icon: 'zap' },
      { to: '/superadmin/storage', label: 'Storage Management', icon: 'hard-drive' },
      { to: '/superadmin/notifications', label: 'Notification Center', icon: 'bell' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/superadmin/features', label: 'Feature Management', icon: 'toggle' },
      { to: '/superadmin/config', label: 'System Configuration', icon: 'settings' },
      { to: '/superadmin/devtools', label: 'Developer Tools', icon: 'code' },
    ],
  },
];

const ICONS = {
  grid: <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" />,
  db: <><path d="M3 5a9 3 0 0 0 18 0a9 3 0 0 0-18 0" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  server: <><rect x="2" y="3" width="20" height="8" rx="1" /><rect x="2" y="13" width="20" height="8" rx="1" /><line x1="6" y1="7" x2="6.01" y2="7" /><line x1="6" y1="17" x2="6.01" y2="17" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  'hard-drive': <><line x1="22" y1="12" x2="2" y2="12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><line x1="6" y1="16" x2="6.01" y2="16" /><line x1="10" y1="16" x2="10.01" y2="16" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  toggle: <><rect x="1" y="5" width="22" height="14" rx="7" /><circle cx="16" cy="12" r="3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  'bar-chart': <><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" rx="0.5" /><rect x="12" y="8" width="3" height="10" rx="0.5" /><rect x="17" y="5" width="3" height="13" rx="0.5" /></>,
  'help-circle': <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  'user-cog': <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><circle cx="19" cy="19" r="2" /><path d="M19 15v2M19 21v.01" /></>,
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  'trending-up': <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
};

function Icon({ name }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name] || ICONS.grid}
    </svg>
  );
}

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem('sa_dark_mode') === 'true');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');

  const filteredNavSections = navSearch.trim()
    ? NAV_SECTIONS
        .map(section => ({
          ...section,
          items: section.items.filter(item =>
            item.label.toLowerCase().includes(navSearch.trim().toLowerCase())
          ),
        }))
        .filter(section => section.items.length > 0)
    : NAV_SECTIONS;

  useEffect(() => {
    localStorage.setItem('sa_dark_mode', String(dark));
  }, [dark]);

  return (
    <div className={`sa-shell ${dark ? 'sa-dark' : 'sa-light'}`}>
      <aside className={`sa-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sa-brand">
          <img src="/uca-logo.png" alt="UCA Logo" className="sa-brand-logo" />
          <div>
            <div className="sa-brand-title">UMS Super Admin</div>
            <div className="sa-brand-sub">Infrastructure &amp; Ops</div>
          </div>
        </div>

        <div className="sa-nav-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search sections…"
            value={navSearch}
            onChange={e => setNavSearch(e.target.value)}
            aria-label="Search infrastructure sections"
          />
          {navSearch && (
            <button className="sa-nav-search-clear" onClick={() => setNavSearch('')} aria-label="Clear search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <nav className="sa-nav">
          {filteredNavSections.length === 0 ? (
            <div className="sa-nav-empty">No matching sections</div>
          ) : filteredNavSections.map(section => (
            <div className="sa-nav-section" key={section.title}>
              <div className="sa-nav-section-title">{section.title}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sa-sidebar-footer">
          <div className="sa-footer-note">Signed in as Super Admin</div>
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <button className="sa-mobile-toggle" onClick={() => setSidebarOpen(o => !o)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="sa-topbar-spacer" />
          <button className="sa-admin-dashboard-btn" onClick={() => navigate('/admin')} title="Return to Admin Dashboard">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Admin Dashboard
          </button>
          <button className="sa-theme-toggle" onClick={() => setDark(d => !d)} title="Toggle dark mode">
            {dark ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>
          <div className="sa-user-chip">
            <div className="sa-user-avatar">{(user?.name || user?.username || 'S')[0].toUpperCase()}</div>
            <div>
              <div className="sa-user-name">{user?.name || user?.username}</div>
              <div className="sa-user-role">Super Admin</div>
            </div>
          </div>
          <button className="sa-logout-btn" onClick={logout} title="Log out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </header>

        <main className="sa-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
