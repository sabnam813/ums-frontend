import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import CountryFlag from './CountryFlag';
import './Sidebar.css';

const ChatIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const AdminNav = [
  {
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    path: '/admin', exact: true,
  },
  {
    label: 'Applications',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
    ),
    path: '/admin/applications',
  },
  {
    label: 'Inquiries',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    path: '/admin/inquiries',
  },
  {
    label: 'Users',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    path: '/admin/users',
  },
  { label: 'Messages', icon: ChatIcon, path: '/admin/chat', chat: true },
  {
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    path: '/admin/settings',
  },
];

const UserNavItems = [
  {
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    path: '/dashboard', exact: true,
  },
  {
    label: 'Inquiries',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    path: '/inquiries',
  },
  { label: 'Messages', icon: ChatIcon, path: '/chat', chat: true },
  {
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    path: '/settings',
  },
];

export default function Sidebar({ countries = [], collapsed, onToggle, isAdmin, mobileOpen, onMobileClose }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useChat();
  const [countriesOpen, setCountriesOpen] = useState(true);
  const [countrySearch, setCountrySearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const navItems = isAdmin ? AdminNav : UserNavItems;

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const q = countrySearch.toLowerCase();
    return countries.filter(c => c.name?.toLowerCase().includes(q));
  }, [countries, countrySearch]);

  const openSearch = () => {
    setSearchOpen(true);
    setCountriesOpen(true);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setCountrySearch('');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/uca-logo.png" alt="UCA Logo" className="sidebar-logo-img" />
          {!collapsed && (
            <div className="sidebar-brand">
              <span className="brand-ums">UMS</span>
            </div>
          )}
        </div>
        <div className="sidebar-header-actions">
          {!collapsed && countries.length > 0 && (
            <button
              className={`sidebar-search-toggle ${searchOpen ? 'active' : ''}`}
              onClick={() => (searchOpen ? closeSearch() : openSearch())}
              aria-label="Search countries"
              title="Search countries"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          )}
                    <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {collapsed
                ? <path d="M9 18l6-6-6-6"/>
                : <path d="M15 18l-6-6 6-6"/>
              }
            </svg>
          </button>
        </div>
      </div>

      {
}
      {!collapsed && searchOpen && (
        <div className="sidebar-quick-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search countries…"
            value={countrySearch}
            onChange={e => setCountrySearch(e.target.value)}
            className="sidebar-search-input"
            autoFocus
          />
          <button className="sidebar-search-clear" onClick={closeSearch} aria-label="Close search">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

            {!collapsed ? (
        <div className="sidebar-user">
          <div className="user-avatar">{(user?.name || user?.username || 'U')[0].toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">{user?.name || user?.username}</span>
            <span className={`user-role ${user?.role}`}>{user?.role === 'admin' ? 'Administrator' : 'Country User'}</span>
          </div>
        </div>
      ) : (
        <div className="sidebar-user collapsed-user" title={user?.name || user?.username}>
          <div className="user-avatar sm">{(user?.name || user?.username || 'U')[0].toUpperCase()}</div>
        </div>
      )}

            <nav className="sidebar-nav">
        <div className="sidebar-nav-top">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon" style={{ position: 'relative' }}>
                {item.icon}
                {item.chat && unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#ef4444', color: '#fff',
                    borderRadius: 10, padding: '1px 5px',
                    fontSize: 10, fontWeight: 700, lineHeight: 1.4,
                    minWidth: 16, textAlign: 'center'
                  }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {!collapsed && item.chat && unreadCount > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#ef4444', color: '#fff',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700
                }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </NavLink>
          ))}
        </div>

        {

}
        {countries.length > 0 && (
          <div className="nav-section">
            {!collapsed && (
              <button
                className="nav-section-header"
                onClick={() => setCountriesOpen(v => !v)}
              >
                <span>Applications</span>
                <svg
                  width="12" height="12"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: countriesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            )}

            {(countriesOpen || collapsed) && (
              <div className="nav-countries-scroll">
                {filteredCountries.map(c => (
                  <NavLink
                    key={c._id || c.code}
                    to={isAdmin ? `/admin/applications/${c._id || c.code}` : `/applications/${c._id || c.code}`}
                    className={({ isActive }) => `nav-item country-item ${isActive ? 'active' : ''}`}
                    title={collapsed ? c.name : undefined}
                  >
                    <span className="nav-icon country-flag">
                      <CountryFlag country={c} size={collapsed ? 22 : 18} rounded={3} />
                    </span>
                    {!collapsed && <span className="nav-label">{c.name}</span>}
                  </NavLink>
                ))}

                                {!collapsed && countrySearch && filteredCountries.length === 0 && (
                  <div className="sidebar-no-results">No match for "{countrySearch}"</div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

            <div className="sidebar-bottom">
        <button
          className="nav-item logout-btn"
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
        >
          <span className="nav-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </span>
          {!collapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
