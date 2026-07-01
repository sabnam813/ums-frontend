import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from 'react-select';
import CountryFlag from '../../components/shared/CountryFlag';
import './AdminUsers.css';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [passTarget, setPassTarget] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, cRes] = await Promise.all([axios.get('/users'), axios.get('/countries')]);
      setUsers(uRes.data.users || []);
      setCountries(cRes.data.countries || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleStatus = async (id, current) => {
    const next = current === 'active' ? 'inactive' : 'active';
    try {
      const res = await axios.put(`/users/${id}/status`, { status: next });
      setUsers(prev => prev.map(u => u._id === id ? res.data.user : u));
      toast.success(`User ${next === 'active' ? 'activated' : 'deactivated'}`);
    } catch (err) { toast.error('Failed to update status'); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user? Their country access will be removed but countries remain.')) return;
    try {
      await axios.delete(`/users/${id}`);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success('User removed');
    } catch (err) { toast.error('Failed to remove user'); }
  };

  const cleanupOrphanedChats = async () => {
    if (!window.confirm('Remove leftover chat conversations from previously deleted users? This cannot be undone.')) return;
    try {
      const res = await axios.delete('/chat/conversations/cleanup-orphaned');
      toast.success(res.data.message || 'Cleanup complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cleanup failed');
    }
  };

  const countryOptions = countries.map(c => ({
    value: c._id, label: `${c.flag || ''} ${c.name}`.trim()
  }));

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner"/><p>Loading users…</p></div>
  );

  return (
    <div className="admin-users animate-fade">
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p>Create users, set credentials, and assign countries</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-add" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', border: '1.5px solid var(--gray-200)' }} onClick={cleanupOrphanedChats} title="Remove chat conversations left behind by previously deleted users">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Clean Up Old Chats
          </button>
          <button className="btn-add" onClick={() => { setEditUser(null); setShowModal(true); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add User
          </button>
        </div>
      </div>

      <div className="users-table-card">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Username</th>
              <th>Assigned Countries</th>
              <th>Last Login</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-row">
                  <div className="dt-empty">
                    <p>No users yet. Click "Add User" to create one.</p>
                  </div>
                </td>
              </tr>
            ) : users.map(u => (
              <tr key={u._id}>
                <td>
                  <div className="user-cell">
                    <div className="user-cell-avatar">{(u.name || u.username)[0].toUpperCase()}</div>
                    <span className="user-cell-name">{u.name || u.username}</span>
                  </div>
                </td>
                <td><code className="username-code">{u.username}</code></td>
                <td>
                  <div className="country-tags">
                    {(u.countries || []).length === 0
                      ? <span className="td-empty">No countries assigned</span>
                      : (u.countries || []).map(c => (
                        <span key={c._id || c} className="country-tag">
                          <CountryFlag country={c} size={14} rounded={2} /> {c.name || c}
                        </span>
                      ))}
                  </div>
                </td>
                <td className="last-login">
                  {u.lastLogin
                    ? new Date(u.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </td>
                <td>
                  <button className={`status-toggle ${u.status}`} onClick={() => toggleStatus(u._id, u.status)}>
                    <span className="status-dot"/>
                    {u.status}
                  </button>
                </td>
                <td>
                  <div className="user-actions">
                    <button className="icon-btn edit" onClick={() => { setEditUser(u); setShowModal(true); }} title="Edit user & countries">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button className="icon-btn" onClick={() => { setPassTarget(u); setShowPassModal(true); }} title="Reset password">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </button>
                    <button className="icon-btn danger" onClick={() => deleteUser(u._id)} title="Delete user">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <UserModal
          user={editUser}
          countryOptions={countryOptions}
          onSave={async (data) => {
            try {
              let res;
              if (editUser) {
                res = await axios.put(`/users/${editUser._id}`, data);
                setUsers(prev => prev.map(u => u._id === editUser._id ? res.data.user : u));
                toast.success('User updated');
              } else {
                res = await axios.post('/users', data);
                setUsers(prev => [...prev, res.data.user]);
                toast.success('User created');
              }
              setShowModal(false); setEditUser(null);
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to save user');
            }
          }}
          onClose={() => { setShowModal(false); setEditUser(null); }}
        />
      )}

      {showPassModal && passTarget && (
        <PasswordModal
          user={passTarget}
          onSave={async ({ password, mustChangePassword }) => {
            try {
              await axios.put(`/users/${passTarget._id}/password`, { password, mustChangePassword });
              toast.success('Password updated');
              setShowPassModal(false); setPassTarget(null);
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to update password');
            }
          }}
          onClose={() => { setShowPassModal(false); setPassTarget(null); }}
        />
      )}
    </div>
  );
}

function UserModal({ user, countryOptions, onSave, onClose }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    password: '',
    confirmPassword: '',
    countries: (user?.countries || []).map(c => ({ value: c._id || c, label: `${c.flag || ''} ${c.name || c}`.trim() })),
  });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = 'Username is required';
    if (!isEdit) {
      if (!form.password) e.password = 'Password is required';
      else if (form.password.length < 6) e.password = 'Minimum 6 characters';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    } else if (form.password) {
      if (form.password.length < 6) e.password = 'Minimum 6 characters';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const data = {
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      countries: form.countries.map(c => c.value),
    };
    if (form.password) data.password = form.password;
    onSave(data);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit User' : 'Add New User'}</h3>
              <p>{isEdit ? 'Update user details and country access' : 'Create a user and assign countries'}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-section">
            <h4>User Details</h4>
            <div className="form-row">
              <div className="field">
                <label>Display Name</label>
                <input type="text" placeholder="e.g. John Smith"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className={`field ${errors.username ? 'has-error' : ''}`}>
                <label>Username *</label>
                <input type="text" placeholder="e.g. john_smith"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/\s/g, '_').toLowerCase() }))} />
                {errors.username && <span className="field-error">{errors.username}</span>}
              </div>
            </div>
          </div>

          {!isEdit && (
            <div className="modal-section">
              <h4>Password</h4>
              <div className="form-row">
                <div className={`field ${errors.password ? 'has-error' : ''}`}>
                  <label>Password *</label>
                  <div className="field-wrap">
                    <input type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                      value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" className="pass-toggle" onClick={() => setShowPass(v => !v)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showPass
                          ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                          : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                      </svg>
                    </button>
                  </div>
                  {errors.password && <span className="field-error">{errors.password}</span>}
                </div>
                <div className={`field ${errors.confirmPassword ? 'has-error' : ''}`}>
                  <label>Confirm Password *</label>
                  <input type={showPass ? 'text' : 'password'} placeholder="Re-enter password"
                    value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                  {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>
              </div>
            </div>
          )}

          <div className="modal-section">
            <h4>Assigned Countries</h4>
            <p className="section-hint">This user can view and manage applications for the selected countries.</p>
            <div className="field">
              <Select
                isMulti
                className="custom-select"
                classNamePrefix="react-select"
                options={countryOptions}
                value={form.countries}
                onChange={opts => setForm(f => ({ ...f, countries: opts || [] }))}
                placeholder="Select countries…"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              {isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordModal({ user, onSave, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mustChange, setMustChange] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password) { setError('Password is required'); return; }
    if (password.length < 6) { setError('Minimum 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    onSave({ password, mustChangePassword: mustChange });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <h3>Reset Password</h3>
              <p>For user: <strong>{user.username}</strong></p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-section">
            <div className={`field ${error ? 'has-error' : ''}`}>
              <label>New Password *</label>
              <div className="field-wrap">
                <input type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                  value={password} onChange={e => { setPassword(e.target.value); setError(''); }} />
                <button type="button" className="pass-toggle" onClick={() => setShowPass(v => !v)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPass
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
            </div>
            <div className="field">
              <label>Confirm Password *</label>
              <input type={showPass ? 'text' : 'password'} placeholder="Re-enter password"
                value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} />
            </div>
            {error && <span className="field-error">{error}</span>}
            <label className="checkbox-label" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={mustChange} onChange={e => setMustChange(e.target.checked)} />
              Require user to change password on next login
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save">Update Password</button>
          </div>
        </form>
      </div>
    </div>
  );
}
