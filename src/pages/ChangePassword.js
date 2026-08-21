import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAccessToken, refreshSession, useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/permissions';
import './Login.css';
import './ChangePassword.css';

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirm) {
      return setError('Passwords do not match');
    }

    if (newPassword.length < 6) {
      return setError('Minimum 6 characters');
    }

    setLoading(true);

    try {
      const token = getAccessToken();

      await axios.post(
        '/auth/change-password',
        { newPassword },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await refreshSession();
      setUser(data.user);

      navigate(
        isAdmin(data.user)
          ? '/admin'
          : '/dashboard'
      );

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to update password. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-root">
      <div className="cp-card">
        <div className="cp-icon-ring">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2>Set your password</h2>
        <p className="cp-subtitle">You must set a new password before continuing.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>New Password</label>
            <div className="input-wrap">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
              <button
                type="button"
                className="toggle-pass"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPass
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-wrap">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>
          </div>

          {error && <div className="cp-error">{error}</div>}

          <button type="submit" className={`login-btn cp-submit-btn ${loading ? 'loading' : ''}`} disabled={loading}>
            {loading ? (<><span className="btn-spinner" /> Saving…</>) : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
