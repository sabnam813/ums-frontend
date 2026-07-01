import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';

function LoadingScreen() {
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
      <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>Loading UMS…</p>
    </div>
  );
}

export function RequireAuth({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RedirectIfAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}
