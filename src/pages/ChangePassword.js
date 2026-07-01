import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAccessToken, setAccessToken, useAuth } from '../context/AuthContext';

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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

      const res = await axios.post(
        '/auth/refresh',
        null,
        {
          withCredentials: true
        }
      );

      setAccessToken(res.data.accessToken);
      setUser(res.data.user);

      navigate(
        res.data.user.role === 'admin'
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5'
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          width: '360px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <h2 style={{ marginBottom: '0.5rem' }}>
          Set your password
        </h2>

        <p
          style={{
            color: '#666',
            fontSize: '14px',
            marginBottom: '1.5rem'
          }}
        >
          You must set a new password before continuing.
        </p>

        <form onSubmit={handleSubmit}>

          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                marginBottom: '4px',
                color: '#444'
              }}
            >
              New password
            </label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder="Minimum 6 characters"
              required
            />
          </div>


          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                marginBottom: '4px',
                color: '#444'
              }}
            >
              Confirm password
            </label>

            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder="Re-enter password"
              required
            />
          </div>


          {error && (
            <p
              style={{
                color: 'red',
                fontSize: '13px',
                marginBottom: '1rem'
              }}
            >
              {error}
            </p>
          )}


          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: '#1a73e8',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Saving...' : 'Set Password & Continue'}
          </button>

        </form>
      </div>
    </div>
  );
}