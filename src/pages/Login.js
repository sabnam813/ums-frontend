import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/permissions';
import toast from 'react-hot-toast';
import './Login.css';

const REMEMBERED_USERNAME_KEY = 'ums_remembered_username';
const REMEMBERED_PASSWORD_KEY = 'ums_remembered_password';

function loadRememberedCredentials() {
  try {
    const username = window.localStorage.getItem(REMEMBERED_USERNAME_KEY);
    if (!username) return null;
    const encodedPassword = window.localStorage.getItem(REMEMBERED_PASSWORD_KEY);
    let password = '';
    if (encodedPassword) {
      try { password = window.atob(encodedPassword); } catch { password = ''; }
    }
    return { username, password };
  } catch {
    return null;
  }
}

function saveRememberedCredentials(username, password) {
  try {
    window.localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
    window.localStorage.setItem(REMEMBERED_PASSWORD_KEY, window.btoa(password));
  } catch {
  }
}

function clearRememberedCredentials() {
  try {
    window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    window.localStorage.removeItem(REMEMBERED_PASSWORD_KEY);
  } catch {
  }
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const remembered = loadRememberedCredentials();
    if (remembered) {
      setUsername(remembered.username);
      setPassword(remembered.password);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(username.trim(), password, rememberMe);
      if (rememberMe) {
        saveRememberedCredentials(username.trim(), password);
      } else {
        clearRememberedCredentials();
      }
      toast.success(`Welcome back, ${user.name || user.username}!`);
      navigate(isAdmin(user) ? '/admin' : '/dashboard');
    } catch (err) {
      if (err.response) {
        toast.error(err.response.data?.message || 'Invalid credentials');
      } else if (err.request) {
        toast.error('Could not reach the server. It may be waking up — please wait a few seconds and try again.');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <aside className="login-brand-panel">
        <div className="login-brand-inner">
          <div className="login-logo-ring">
            <img src="/uca-logo.png" alt="UCA Logo" className="login-logo-img" />
          </div>
          <h1 className="login-brand">
            <span className="brand-uni">Uni</span><span className="brand-consultants">Consultants</span>
            <br /><span className="brand-alliance">Alliance</span>
          </h1>
          <p className="login-subtitle">Management System</p>
        </div>
      </aside>

      <main className="login-form-panel">
        <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
          <h2 className="login-title">Sign In</h2>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrap">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                id="password"
                name="password"
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
              <button type="button" className="toggle-pass" onClick={() => setShowPass(v => !v)} tabIndex={-1} aria-label={showPass ? 'Hide password' : 'Show password'}>
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <label className="remember-me-row">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} disabled={loading} />
            Remember me
          </label>

          <button type="submit" className={`login-btn ${loading ? 'loading' : ''}`} disabled={loading}>
            {loading ? (<><span className="btn-spinner" />Signing in…</>) : 'Sign In'}
          </button>

          <p className="login-footer">UCA Management System &copy; {new Date().getFullYear()}</p>
        </form>
      </main>
    </div>
  );
}
