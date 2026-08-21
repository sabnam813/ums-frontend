import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';
import { useFiscalYear } from '../../context/FiscalYearContext';
import { canAccessTestPrep, isAdmin as checkIsAdmin } from '../../utils/permissions';
import axios from 'axios';
import './Layout.css';

function getPageInfo(pathname) {
  if (pathname === '/admin') return { title: 'Dashboard', breadcrumb: ['Admin', 'Dashboard'] };
  if (pathname === '/admin/applications') return { title: 'Applications', breadcrumb: ['Admin', 'Applications'] };
  if (pathname.startsWith('/admin/applications/')) return { title: 'Applications', breadcrumb: ['Admin', 'Applications', 'Country'] };
  if (pathname === '/admin/users') return { title: 'Users', breadcrumb: ['Admin', 'Users'] };
  if (pathname === '/admin/settings') return { title: 'Settings', breadcrumb: ['Admin', 'Settings'] };
  if (pathname === '/admin/reports') return { title: 'Reports', breadcrumb: ['Admin', 'Reports'] };
  if (pathname === '/admin/achievements') return { title: 'Achievements', breadcrumb: ['Admin', 'Achievements'] };
  if (pathname === '/admin/system') return { title: 'System Dashboard', breadcrumb: ['Admin', 'System Dashboard'] };
  if (pathname === '/admin/test-prep') return { title: 'Test Preparation', breadcrumb: ['Admin', 'Test Preparation'] };
  if (pathname.startsWith('/admin/test-prep/')) return { title: 'Test Preparation', breadcrumb: ['Admin', 'Test Preparation', 'Bookings'] };
  if (pathname === '/test-prep') return { title: 'Test Preparation', breadcrumb: ['Test Preparation'] };
  if (pathname.startsWith('/test-prep/')) return { title: 'Test Preparation', breadcrumb: ['Test Preparation', 'Bookings'] };
  if (pathname === '/admin/contacts') return { title: 'Contacts', breadcrumb: ['Admin', 'Contacts'] };
  if (pathname.startsWith('/admin/contacts/')) return { title: 'Contacts', breadcrumb: ['Admin', 'Contacts', 'Group'] };
  if (pathname === '/contacts') return { title: 'Contacts', breadcrumb: ['Contacts'] };
  if (pathname.startsWith('/contacts/')) return { title: 'Contacts', breadcrumb: ['Contacts', 'Group'] };
  if (pathname === '/dashboard') return { title: 'Dashboard', breadcrumb: ['Dashboard'] };
  if (pathname === '/settings') return { title: 'Settings', breadcrumb: ['Settings'] };
  if (pathname === '/reports') return { title: 'Reports', breadcrumb: ['Reports'] };
  if (pathname === '/achievements') return { title: 'Achievements', breadcrumb: ['Achievements'] };
  if (pathname.startsWith('/applications/')) return { title: 'Applications', breadcrumb: ['Applications', 'Country'] };
  return { title: 'UMS', breadcrumb: ['Home'] };
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [countries, setCountries] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [contactGroups, setContactGroups] = useState([]);
  const { user } = useAuth();
  const { dateFrom, dateTo } = useFiscalYear();
  const location = useLocation();
  const isAdmin = checkIsAdmin(user);
  const { title, breadcrumb } = getPageInfo(location.pathname);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = () => { if (window.innerWidth > 768) setMobileOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const fetchCountries = async () => {
    try {
      const res = await axios.get(isAdmin ? '/countries' : '/countries/mine', {
        params: { dateFrom, dateTo },
      });
      setCountries(res.data.countries || []);
    } catch (err) {
      setCountries([]);
    }
  };

  const fetchTestTypes = async () => {
    if (!canAccessTestPrep(user)) {
      setTestTypes([]);
      return;
    }
    try {
      const res = await axios.get('/test-types');
      setTestTypes(res.data.testTypes || []);
    } catch (err) {
      setTestTypes([]);
    }
  };

  const fetchContactGroups = async () => {
    try {
      const res = await axios.get('/contact-groups');
      setContactGroups(res.data.groups || []);
    } catch (err) {
      setContactGroups([]);
    }
  };

  useEffect(() => {
    fetchCountries();
    fetchTestTypes();
    fetchContactGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user, dateFrom, dateTo]);

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
          <Outlet context={{
            countries, setCountries, refetchCountries: fetchCountries,
            testTypes, setTestTypes, refetchTestTypes: fetchTestTypes,
            contactGroups, setContactGroups, refetchContactGroups: fetchContactGroups,
            isAdmin,
          }} />
        </main>
      </div>
    </div>
  );
}
