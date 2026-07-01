import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useFieldConfig } from '../hooks/useFieldConfig';
import FormFieldsManager from '../components/admin/FormFieldsManager';
import './Settings.css';

export default function Settings() {
  const { user, setUser } = useAuth();
  const isAdmin = user?.role === 'admin';
  const fieldConfig = useFieldConfig();

  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await axios.put('/auth/me', { name: name.trim() });
      setUser(res.data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await axios.post('/auth/change-password-secure', {
        currentPassword,
        newPassword,
      });
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="settings-root animate-fade">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Manage your account, security, and preferences</p>
        </div>
      </div>

      <div className="settings-grid">
                <div className="settings-card account-card">
          <div className="settings-card-header">
            <h3>Account</h3>
          </div>
          <div className="account-overview">
            <div className="account-avatar-lg">
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="account-overview-info">
              <span className="account-name">{user?.name || user?.username}</span>
              <span className={`account-role-badge ${user?.role}`}>
                {isAdmin ? 'Administrator' : 'Country User'}
              </span>
            </div>
          </div>
          <div className="account-meta-list">
            <div className="account-meta-row">
              <span className="meta-label">Username</span>
              <code className="meta-value-code">{user?.username}</code>
            </div>
            <div className="account-meta-row">
              <span className="meta-label">Status</span>
              <span className={`meta-status ${user?.status || 'active'}`}>
                <span className="meta-status-dot" />
                {user?.status || 'active'}
              </span>
            </div>
            {user?.countries?.length > 0 && (
              <div className="account-meta-row">
                <span className="meta-label">Assigned Countries</span>
                <span className="meta-value">{user.countries.length}</span>
              </div>
            )}
            {user?.lastLogin && (
              <div className="account-meta-row">
                <span className="meta-label">Last Login</span>
                <span className="meta-value">
                  {new Date(user.lastLogin).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

                <div className="settings-card">
          <div className="settings-card-header">
            <h3>Profile</h3>
            <p>Update your display name</p>
          </div>
          <form onSubmit={handleProfileSave} className="settings-form">
            <div className="settings-field">
              <label>Display Name</label>
              <input
                type="text"
                className="settings-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="settings-field">
              <label>Username</label>
              <input
                type="text"
                className="settings-input"
                value={user?.username || ''}
                disabled
              />
              <span className="settings-hint">Username cannot be changed</span>
            </div>
            <div className="settings-form-actions">
              <button type="submit" className="settings-save-btn" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

                <div className="settings-card">
          <div className="settings-card-header">
            <h3>Security</h3>
            <p>Change your password</p>
          </div>
          <form onSubmit={handlePasswordSave} className="settings-form">
            <div className="settings-field">
              <label>Current Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                className="settings-input"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>
            <div className="settings-grid-2">
              <div className="settings-field">
                <label>New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="settings-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="settings-field">
                <label>Confirm New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="settings-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={e => setShowPasswords(e.target.checked)}
              />
              Show passwords
            </label>
            <div className="settings-form-actions">
              <button type="submit" className="settings-save-btn" disabled={savingPassword}>
                {savingPassword ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

                {isAdmin && (
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>System</h3>
              <p>UCA Management System information</p>
            </div>
            <div className="account-meta-list">
              <div className="account-meta-row">
                <span className="meta-label">Application</span>
                <span className="meta-value">UMS – UCA Management System</span>
              </div>
              <div className="account-meta-row">
                <span className="meta-label">Role</span>
                <span className="meta-value">Administrator</span>
              </div>
              <div className="account-meta-row">
                <span className="meta-label">Session Security</span>
                <span className="meta-value">JWT access token (24h) + refresh cookie (7d)</span>
              </div>
            </div>
          </div>
        )}

                {isAdmin && (
          <FormFieldsManager
            fieldConfig={fieldConfig}
            refetchFields={async () => {
              await fieldConfig.refetch();
              fieldConfig.broadcastChange();
            }}
          />
        )}
      </div>
    </div>
  );
}
