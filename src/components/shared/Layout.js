import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Layout.css';

function getPageInfo(pathname) {
  if (pathname === '/admin') return { title: 'Dashboard', breadcrumb: ['Admin', 'Dashboard'] };
  if (pathname === '/admin/applications') return { title: 'Applications', breadcrumb: ['Admin', 'Applications'] };
  if (pathname.startsWith('/admin/applications/')) return { title: 'Applications', breadcrumb: ['Admin', 'Applications', 'Country'] };
  if (pathname === '/admin/users') return { title: 'Users', breadcrumb: ['Admin', 'Users'] };
  if (pathname === '/admin/settings') return { title: 'Settings', breadcrumb: ['Admin', 'Settings'] };
  if (pathname === '/dashboard') return { title: 'Dashboard', breadcrumb: ['Dashboard'] };
  if (pathname === '/settings') return { title: 'Settings', breadcrumb: ['Settings'] };
  if (pathname.startsWith('/applications/')) return { title: 'Applications', breadcrumb: ['Applications', 'Country'] };
  return { title: 'UMS', breadcrumb: ['Home'] };
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [countries, setCountries] = useState([]);
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const { title, breadcrumb } = getPageInfo(location.pathname);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = () => { if (window.innerWidth > 768) setMobileOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const fetchCountries = async () => {
    try {
      const res = await axios.get(isAdmin ? '/countries' : '/countries/mine');
      setCountries(res.data.countries || []);
    } catch (err) {
      setCountries([]);
    }
  };

  useEffect(() => { fetchCountries(); }, [isAdmin]);

  return (
    <div className="app-layout">
            {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar
        countries={countries}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        isAdmin={isAdmin}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

            {collapsed && (
        <button
          className="sidebar-expand-fab"
          onClick={() => setCollapsed(false)}
          title="Open sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      )}

      <div className="app-main">
        <Topbar
          title={title}
          breadcrumb={breadcrumb}
          onMobileMenuToggle={() => setMobileOpen(v => !v)}
          mobileOpen={mobileOpen}
        />
        <main className="app-content">
          <Outlet context={{ countries, setCountries, refetchCountries: fetchCountries }} />
        </main>
      </div>
    </div>
  );
}
