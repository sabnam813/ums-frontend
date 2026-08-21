import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useFiscalYear } from '../../context/FiscalYearContext';
import { isSuperAdmin } from '../../utils/permissions';
import { hasPermission } from '../../utils/rbac';
import { FISCAL_YEARS, FY_ALL } from '../../utils/fiscalYear';
import CountryFlag from './CountryFlag';
import './Sidebar.css';

const AppsIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
  </svg>
);

const ChatIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const TrashIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const ContactsIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-1a4 4 0 0 0-3-3.87"/>
    <line x1="19" y1="8" x2="19" y2="12"/><line x1="17" y1="10" x2="21" y2="10"/>
  </svg>
);

const FollowUpIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.71a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.47 5.47l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const ReportsIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="0.5"/>
    <rect x="12" y="8" width="3" height="10" rx="0.5"/><rect x="17" y="5" width="3" height="13" rx="0.5"/>
  </svg>
);

const DailyReportIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
  </svg>
);

const AchievementsIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18"/>
    <path d="M18.7 8l-5.1 5.1-2.6-2.6L7 14.5"/>
  </svg>
);

const PortalIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="16" rx="2"/>
    <path d="M3 9h18"/>
    <circle cx="7" cy="6.5" r="0.6" fill="currentColor" stroke="none"/>
    <circle cx="9.5" cy="6.5" r="0.6" fill="currentColor" stroke="none"/>
    <path d="M8 14l2.5 2.5L16 11"/>
  </svg>
);

const DiaryIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const CalendarIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
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
    requireModule: 'applications',
  },
  {
    label: 'Test Preparation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    ),
    path: '/admin/test-prep',
    requireModule: 'testPreparation',
  },
  {
    label: 'Contacts',
    icon: ContactsIcon,
    path: '/admin/contacts',
    requireModule: 'contacts',
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
    requireModule: 'inquiry',
  },
  {
    label: 'Follow Up',
    icon: FollowUpIcon,
    path: '/admin/follow-up',
    requireModule: 'followUp',
  },
  {
    label: 'Reports',
    icon: ReportsIcon,
    path: '/admin/reports',
    requireModule: 'reports',
  },
  {
    label: 'Achievements',
    icon: AchievementsIcon,
    path: '/admin/achievements',
    requireModule: 'achievements',
  },
  {
    label: 'Daily Report',
    icon: DailyReportIcon,
    path: '/admin/daily-report',
    requireModule: 'dailyReport',
  },
  {
    label: 'Portal',
    icon: PortalIcon,
    path: '/admin/portal',
    requireModule: 'portal',
  },
  {
    label: 'Diary',
    icon: DiaryIcon,
    path: '/admin/diary',
    superAdminOnly: true,
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
    superAdminOnly: true,
  },
  {
    label: 'Departments',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
    path: '/admin/departments',
    superAdminOnly: true,
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
    label: 'Test Preparation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    ),
    path: '/test-prep',
    requireModule: 'testPreparation',
  },
  {
    label: 'Contacts',
    icon: ContactsIcon,
    path: '/contacts',
    requireModule: 'contacts',
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
    requireModule: 'inquiry',
  },
  {
    label: 'Follow Up',
    icon: FollowUpIcon,
    path: '/follow-up',
    requireModule: 'followUp',
  },
  {
    label: 'Reports',
    icon: ReportsIcon,
    path: '/reports',
    requireModule: 'reports',
  },
  {
    label: 'Achievements',
    icon: AchievementsIcon,
    path: '/achievements',
    requireModule: 'achievements',
  },
  {
    label: 'Daily Report',
    icon: DailyReportIcon,
    path: '/daily-report',
    requireModule: 'dailyReport',
  },
  {
    label: 'Portal',
    icon: PortalIcon,
    path: '/portal',
    requireModule: 'portal',
  },
  { label: 'Messages', icon: ChatIcon, path: '/chat', chat: true },
  { label: 'Trash', icon: TrashIcon, path: '/trash', requireModule: 'trash' },
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

export default function Sidebar({ collapsed, onToggle, isAdmin, mobileOpen, onMobileClose, countries = [] }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useChat();
  const { fiscalYear, setFiscalYear } = useFiscalYear();
  const location = useLocation();
  const [appsOpen, setAppsOpen] = useState(true);
  const [navSearch, setNavSearch] = useState('');
  const [fyOpen, setFyOpen] = useState(false);
  const fyRef = useRef();

  const viewerIsSuperAdmin = isSuperAdmin(user);
  const baseNav = isAdmin ? AdminNav : UserNavItems;
  const navItems = baseNav.filter(item => {
    if (item.requireModule && !hasPermission(user, item.requireModule, 'access')) return false;
    if (item.superAdminOnly && !viewerIsSuperAdmin) return false;
    return true;
  });

  useEffect(() => {
    if (collapsed) { setNavSearch(''); setFyOpen(false); }
  }, [collapsed]);

  useEffect(() => {
    const handler = (e) => {
      if (fyRef.current && !fyRef.current.contains(e.target)) setFyOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visibleNavItems = navSearch.trim()
    ? navItems.filter(item => item.label.toLowerCase().includes(navSearch.trim().toLowerCase()))
    : navItems;

  const showApplicationsDropdown = !isAdmin && !collapsed && countries.length > 0;
  const applicationsActive = location.pathname.startsWith('/applications/');

  const shortLabel = fiscalYear === FY_ALL
    ? 'All'
    : fiscalYear.replace('20', '').replace('/20', '/');

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

      {!collapsed ? (
        <div className="sidebar-user">
          <div className="user-avatar">{(user?.name || user?.username || 'U')[0].toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">{user?.name || user?.username}</span>
            <span className={`user-role ${user?.role}`}>
              {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Administrator' : 'Staff'}
            </span>
          </div>
        </div>
      ) : (
        <div className="sidebar-user collapsed-user" title={user?.name || user?.username}>
          <div className="user-avatar sm">{(user?.name || user?.username || 'U')[0].toUpperCase()}</div>
        </div>
      )}

      <nav className="sidebar-nav">
        {}
        {!collapsed ? (
          <div className="sidebar-fy-wrap" ref={fyRef}>
            <button
              className={`sidebar-fy-btn ${fyOpen ? 'open' : ''} ${fiscalYear === FY_ALL ? 'fy-all' : ''}`}
              onClick={() => setFyOpen(v => !v)}
              title={`Fiscal Year: ${fiscalYear === FY_ALL ? 'All Data' : fiscalYear}`}
            >
              <span className="sidebar-fy-icon">{CalendarIcon}</span>
              <span className="sidebar-fy-label">
                FY: <strong>{shortLabel}</strong>
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ marginLeft: 'auto', transform: fyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {fyOpen && (
              <div className="sidebar-fy-dropdown">
                <div className="sidebar-fy-header">Filter by Fiscal Year</div>
                {}
                <button
                  className={`sidebar-fy-item ${fiscalYear === FY_ALL ? 'active' : ''}`}
                  onClick={() => { setFiscalYear(FY_ALL); setFyOpen(false); }}
                >
                  <span className="sidebar-fy-item-label">All Data</span>
                  <span className="sidebar-fy-item-sub">No date filter</span>
                  {fiscalYear === FY_ALL && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
                {FISCAL_YEARS.map(fy => (
                  <button
                    key={fy.label}
                    className={`sidebar-fy-item ${fiscalYear === fy.label ? 'active' : ''}`}
                    onClick={() => { setFiscalYear(fy.label); setFyOpen(false); }}
                  >
                    <span className="sidebar-fy-item-label">{fy.label}</span>
                    <span className="sidebar-fy-item-sub">{fy.from} → {fy.to}</span>
                    {fiscalYear === fy.label && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="sidebar-fy-collapsed"
            title={`FY: ${fiscalYear === FY_ALL ? 'All' : fiscalYear}`}
            onClick={() => {  onToggle && onToggle(); }}
          >
            <span className="sidebar-fy-collapsed-label">{shortLabel}</span>
          </div>
        )}

        {}
        {!collapsed && (
          <div className="sidebar-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search menu…"
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              aria-label="Search navigation"
            />
            {navSearch && (
              <button className="sidebar-search-clear" onClick={() => setNavSearch('')} aria-label="Clear search">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="sidebar-nav-top">
          {visibleNavItems.length === 0 ? (
            <div className="sidebar-nav-empty">No matching items</div>
          ) : visibleNavItems.map(item => (
            <React.Fragment key={item.path}>
              <NavLink
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

              {item.label === 'Dashboard' && showApplicationsDropdown && (
                <div className="nav-section">
                  <button
                    type="button"
                    className={`nav-section-header ${applicationsActive ? 'active' : ''}`}
                    onClick={() => setAppsOpen(v => !v)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span className="nav-icon">{AppsIcon}</span>
                      <span>Applications</span>
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: appsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>

                  {appsOpen && (
                    <div className="nav-countries-scroll">
                      {countries.map(c => (
                        <NavLink
                          key={c._id}
                          to={`/applications/${c._id}`}
                          className={({ isActive }) => `nav-item country-item ${isActive ? 'active' : ''}`}
                        >
                          <span className="nav-icon"><CountryFlag country={c} size={16} rounded={2} /></span>
                          <span className="nav-label">{c.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
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
