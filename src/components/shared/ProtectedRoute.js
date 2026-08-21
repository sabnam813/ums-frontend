import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { isAdmin, isSuperAdmin, canAccessTestPrep, canAccessInquiry, canAccessFollowUp, canAccessDailyReport, canAccessTrash, canAccessModule, canAccessPortal } from '../../utils/permissions';

function LoadingScreen({ wakingUp }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'var(--gray-50)'
    }}>
      <div style={{
        width: 44, height: 44,
        border: '3px solid var(--gray-200)',
        borderTopColor: 'var(--uca-blue)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite'
      }} />
      <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>
        {wakingUp ? 'Just a moment, getting things ready. This can take up to a minute…' : 'Loading UMS…'}
      </p>
    </div>
  );
}

export function RequireAuth({
  children,
  adminOnly = false,
  testPrepOnly = false,
  superAdminOnly = false,
  inquiryOnly = false,
  followUpOnly = false,
  dailyReportOnly = false,
  trashOnly = false,
  reportsOnly = false,
  achievementsOnly = false,
  portalOnly = false,
}) {
  const { user, loading, wakingUp } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen wakingUp={wakingUp} />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly) {
    if (!isAdmin(user)) return <Navigate to="/dashboard" replace />;
  }

  if (superAdminOnly && !isSuperAdmin(user)) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  if (testPrepOnly && !canAccessTestPrep(user)) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  if (inquiryOnly && !canAccessInquiry(user)) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  if (followUpOnly && !canAccessFollowUp(user)) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  if (dailyReportOnly && !canAccessDailyReport(user)) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  if (trashOnly && !canAccessTrash(user)) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  if (reportsOnly && !canAccessModule(user, 'reports')) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  if (achievementsOnly && !canAccessModule(user, 'achievements')) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  if (portalOnly && !canAccessPortal(user)) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }

  return children;
}

export function RedirectIfAuth({ children }) {
  const { user, loading, wakingUp } = useAuth();
  if (loading) return <LoadingScreen wakingUp={wakingUp} />;
  if (user) {
    return <Navigate to={isAdmin(user) ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}
