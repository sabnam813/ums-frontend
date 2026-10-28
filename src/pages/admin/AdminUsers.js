import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from 'react-select';
import CountryFlag from '../../components/shared/CountryFlag';
import { useAuth, getRefreshBody } from '../../context/AuthContext';
import { isSuperAdmin } from '../../utils/permissions';
import PermissionMatrix from '../../components/shared/PermissionMatrix';
import {
  MODULES, ACTIONS, REPORT_MODES,
  basePermissions, baseReportMode, diffFromBase, applyOverrides,
} from '../../utils/rbac';
import './AdminUsers.css';
import './Departments.css';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const viewerIsSuperAdmin = isSuperAdmin(currentUser);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [countries, setCountries] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [passTarget, setPassTarget] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, cRes, dRes] = await Promise.all([
        axios.get('/users'),
        axios.get('/countries'),
        axios.get('/departments'),
      ]);
      setUsers(uRes.data.users || []);
      setCountries(cRes.data.countries || []);
      setDepartments(dRes.data.departments || []);
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
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status'); }
  };

  const changeRole = async (id, currentRole) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    const label = nextRole === 'admin' ? 'promote this user to Admin' : 'demote this Admin back to Staff';
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    try {
      const res = await axios.put(`/users/${id}/role`, { role: nextRole });
      setUsers(prev => prev.map(u => u._id === id ? res.data.user : u));
      toast.success(nextRole === 'admin' ? 'User promoted to Admin' : 'User demoted to Staff');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Move this user to trash? Their chats will be removed, but the user record can be restored from the Trash page.')) return;
    try {
      await axios.delete(`/users/${id}`);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success('User moved to trash');
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

  const q = query.trim().toLowerCase();
  const visibleUsers = !q ? users : users.filter(u => {
    const depts = u.departments && u.departments.length > 0 ? u.departments : (u.department ? [u.department] : []);
    const cn = (u.countries || []).map(c => (c && c.name) || '');
    const hay = [u.name, u.username, u.role, u.status, ...depts, ...cn].filter(Boolean).join(' ').toLowerCase();
    return q.split(/\s+/).every(t => hay.includes(t));
  });

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner"/><p>Loading users…</p></div>
  );

  return (
    <div className="admin-users animate-fade">
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p>{viewerIsSuperAdmin ? 'Create users, set credentials, assign countries, and grant permissions.' : 'Create users, set credentials, and assign countries.'}</p>
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

      <div className="list-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, username, department, country, role" />
        {query && <button type="button" className="list-search-clear" onClick={() => setQuery('')}>&times;</button>}
      </div>

      <div className="users-table-card">
        {users.length === 0 ? (
          <div className="dt-empty">
            <p>No users yet. Click "Add User" to create one.</p>
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="dt-empty">
            <p>No users match your search.</p>
          </div>
        ) : (
          <div className="dept-grid">
            {visibleUsers.map(u => {
              const deptList = u.departments && u.departments.length > 0
                ? u.departments
                : (u.department ? [u.department] : []);
              const permChips = [
                { key: 'testPreparation', label: 'Test Prep', on: !!u.permissions?.testPreparation?.access },
                { key: 'inquiry', label: 'Inquiry', on: !!u.permissions?.inquiry?.access },
                { key: 'followUp', label: 'Follow Up', on: !!u.permissions?.followUp?.access },
                {
                  key: 'dailyReport',
                  label: u.permissions?.dailyReport?.access ? `Daily Report: ${({ view: 'View Only', both: 'Write + View', write: 'Write' })[u.dailyReportMode || (u.dailyReportViewOnly ? 'view' : 'write')]}` : 'Daily Report',
                  on: !!u.permissions?.dailyReport?.access
                },
              ];
              return (
                <div key={u._id} className="dept-card user-card">
                  <div className="dept-card-header">
                    <div className="dept-card-title">
                      <div className="dept-icon">{(u.name || u.username)[0].toUpperCase()}</div>
                      <div>
                        <h3>{u.name || u.username}</h3>
                        <span className="dept-country-count">@{u.username}</span>
                      </div>
                    </div>
                    <div className="dept-card-actions">
                      {viewerIsSuperAdmin && (
                        <button
                          className="icon-btn"
                          onClick={() => changeRole(u._id, u.role)}
                          title={u.role === 'admin' ? 'Demote to Staff' : 'Promote to Admin'}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {u.role === 'admin'
                              ? <polyline points="19 12 12 19 5 12" />
                              : <polyline points="5 12 12 5 19 12" />}
                            <line x1="12" y1="5" x2="12" y2="19" />
                          </svg>
                        </button>
                      )}
                      <button className="icon-btn edit" onClick={() => { setEditUser(u); setShowModal(true); }} title={viewerIsSuperAdmin ? 'Edit user, countries & permissions' : 'Edit user & countries'}>
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
                  </div>

                  <div className="user-card-meta">
                    {viewerIsSuperAdmin && (
                      <span className={`user-role-badge ${u.role}`}>{u.role === 'admin' ? 'Admin' : 'Staff'}</span>
                    )}
                    <button className={`status-toggle ${u.status}`} onClick={() => toggleStatus(u._id, u.status)} title="Toggle active/inactive — this never deletes or hides their existing data, it only blocks login">
                      <span className="status-dot"/>
                      {u.status}
                    </button>
                    <span className="user-last-login">
                      {u.lastLogin
                        ? `Last login ${new Date(u.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'Never logged in'}
                    </span>
                  </div>

                  {deptList.length > 0 && (
                    <div className="dept-countries" style={{ marginBottom: 8 }}>
                      {deptList.map((d, i) => (
                        <span key={i} className="dept-country-tag">{d}</span>
                      ))}
                    </div>
                  )}

                  <div className="dept-perm-summary">
                    {permChips.map(c => (
                      <span key={c.key} className={`dept-perm-chip ${c.on ? 'active' : 'inactive'}`}>{c.label}</span>
                    ))}
                  </div>

                  <div className="dept-countries">
                    {u.allCountries ? (
                      <span className="dept-country-tag">🌐 All countries</span>
                    ) : (u.countries || []).length === 0 ? (
                      <span className="td-empty">No countries assigned</span>
                    ) : (
                      <>
                        {(u.countries || []).slice(0, 4).map(c => (
                          <span key={c._id || c} className="dept-country-tag">
                            <CountryFlag country={c} size={12} rounded={2} /> {c.name || c}
                          </span>
                        ))}
                        {(u.countries || []).length > 4 && (
                          <span className="dept-country-tag dept-more">+{(u.countries || []).length - 4} more</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <UserModal
          viewerIsSuperAdmin={viewerIsSuperAdmin}
          user={editUser}
          countryOptions={countryOptions}
          departments={departments}
          onSave={async (data) => {
            try {
              let res;
              if (editUser) {
                if (!window.confirm('Save changes to this user?')) return;
                res = await axios.put(`/users/${editUser._id}`, { ...data, ...getRefreshBody() });
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
              await axios.put(`/users/${passTarget._id}/password`, { password, mustChangePassword, ...getRefreshBody() });
              toast.success('Password updated. Other devices of that user were signed out.');
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

function UserModal({ user, countryOptions, departments, onSave, onClose, viewerIsSuperAdmin }) {
  const isEdit = !!user;
  const isEditingAdmin = isEdit && user.role === 'admin';
  const canEditPermissions = viewerIsSuperAdmin;

  const initialPermissions = {};
  MODULES.forEach(({ key }) => {
    const existing = user?.permissions?.[key] || {};
    initialPermissions[key] = {};
    ACTIONS.forEach(({ key: action }) => { initialPermissions[key][action] = !!existing[action]; });
  });

  const existingDepts = user?.departments && user.departments.length > 0
    ? user.departments
    : (user?.department ? [user.department] : []);

  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    password: '',
    confirmPassword: '',
    departments: existingDepts,
    permissions: initialPermissions,
    countries: (user?.countries || []).map(c => ({ value: c._id || c, label: `${c.flag || ''} ${c.name || c}`.trim() })),
    dailyReportMode: user?.dailyReportMode || (user?.dailyReportViewOnly ? 'view' : (user?.role === 'admin' ? 'view' : 'write')),
    dailyReportDepartments: user?.dailyReportDepartments || [],
    _deptAllCountries: departments.some(d => existingDepts.includes(d.name) && d.allCountries),
  });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadingDeptPerms, setLoadingDeptPerms] = useState(false);

  const effectiveCountryOptions = React.useMemo(() => {
    const known = new Set(countryOptions.map(o => o.value));
    const missing = form.countries.filter(sc => !known.has(sc.value));
    return missing.length > 0 ? [...countryOptions, ...missing] : countryOptions;
  }, [countryOptions, form.countries]);

  const hasDepts = form.departments.length > 0;

  const deptDocs = (names) => departments.filter(d => names.includes(d.name));
  const userRole = user?.role || 'user';

  const basePerms = React.useMemo(
    () => basePermissions(userRole, deptDocs(form.departments)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.departments, departments, userRole]
  );
  const baseMode = baseReportMode(userRole, deptDocs(form.departments));

  const applyDepartments = async (deptNames) => {
    setLoadingDeptPerms(true);
    try {
      const oldBase = basePermissions(userRole, deptDocs(form.departments));
      const overrides = diffFromBase(form.permissions, oldBase);
      const newDepts = deptDocs(deptNames);
      const merged = applyOverrides(basePermissions(userRole, newDepts), overrides);

      const hasAllCountries = newDepts.some(d => d.allCountries);
      const oldDeptIds = new Set(deptDocs(form.departments).flatMap(d => (d.countries || []).map(c => c._id || c)));
      const newDeptCountries = {};
      newDepts.forEach(d => (d.countries || []).forEach(c => {
        const id = c._id || c;
        newDeptCountries[id] = { value: id, label: `${c.flag || ''} ${c.name || c}`.trim() };
      }));
      const individual = form.countries.filter(c => !oldDeptIds.has(c.value));
      const countryMap = {};
      [...Object.values(newDeptCountries), ...individual].forEach(c => { countryMap[c.value] = c; });

      const oldMode = baseReportMode(userRole, deptDocs(form.departments));
      const modeWasOverridden = form.dailyReportMode !== oldMode;

      setForm(f => ({
        ...f,
        permissions: merged,
        countries: hasAllCountries ? f.countries : Object.values(countryMap),
        _deptAllCountries: hasAllCountries,
        dailyReportMode: modeWasOverridden ? f.dailyReportMode : baseReportMode(userRole, newDepts),
      }));
    } finally {
      setLoadingDeptPerms(false);
    }
  };

  const handleDeptChange = async (deptName, checked) => {
    const next = checked
      ? [...form.departments, deptName]
      : form.departments.filter(d => d !== deptName);
    await applyDepartments(next);
    setForm(f => ({ ...f, departments: next }));
  };

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
      department: form.departments[0] || '',
      departments: form.departments,
      countries: form.countries.map(c => c.value),
    };
    if (canEditPermissions) data.permissions = form.permissions;
    if (canEditPermissions) data.dailyReportMode = form.dailyReportMode;
    if (canEditPermissions) data.dailyReportDepartments = form.dailyReportDepartments;
    if (form.password) data.password = form.password;
    onSave(data);
  };

  const deptLocked = hasDepts;
  const deptAllCountries = !!form._deptAllCountries;

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

            <div className="field">
              <label>Departments <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 12 }}>(select one or more)</span></label>
              {departments.length === 0 ? (
                <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>No departments created yet.</p>
              ) : (
                <div className="dept-multi-list">
                  {departments.map(d => {
                    const checked = form.departments.includes(d.name);
                    return (
                      <label key={d._id} className={`dept-multi-item ${checked ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => handleDeptChange(d.name, e.target.checked)}
                          style={{ marginRight: 7 }}
                        />
                        <span className="dept-multi-name">{d.name}</span>
                        {d.countries && d.countries.length > 0 && (
                          <span className="dept-multi-countries">
                            {d.allCountries ? 'All countries' : `${d.countries.length} countr${d.countries.length === 1 ? 'y' : 'ies'}`}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              {hasDepts && (
                <span className="field-error" style={{ color: 'var(--uca-blue)', fontStyle: 'italic' }}>
                  {loadingDeptPerms
                    ? 'Merging permissions from selected departments…'
                    : `✓ Permissions and country access merged from ${form.departments.join(', ')}.`}
                </span>
              )}
            </div>
          </div>

          {(!isEdit || canEditPermissions) && (
            <div className="modal-section">
              <h4>{isEdit ? 'New Password' : 'Password'}</h4>
              {isEdit && <p className="section-hint">Leave empty to keep the current password. Changing it signs the user out everywhere.</p>}
              <div className="form-row">
                <div className={`field ${errors.password ? 'has-error' : ''}`}>
                  <label>{isEdit ? 'New Password' : 'Password *'}</label>
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
                  <label>{isEdit ? 'Confirm New Password' : 'Confirm Password *'}</label>
                  <input type={showPass ? 'text' : 'password'} placeholder="Re-enter password"
                    value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                  {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>
              </div>
            </div>
          )}

          <div className="modal-section">
            <h4>Assigned Countries</h4>
            <p className="section-hint">
              {deptLocked
                ? 'Countries from the selected department(s) are added automatically. You can add more for this person below.'
                : 'This user can view and manage applications for the selected countries.'}
            </p>
            {deptAllCountries ? (
              <div className="dept-inherited-note">All countries (granted by department)</div>
            ) : (
              <div className="field">
                <Select
                  isMulti
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={effectiveCountryOptions}
                  value={form.countries}
                  onChange={opts => setForm(f => ({ ...f, countries: opts || [] }))}
                  placeholder="Select countries…"
                />
              </div>
            )}
          </div>

          {canEditPermissions && (
            <div className="modal-section">
              <h4>Modules &amp; Permissions</h4>
              <p className="section-hint">
                {deptLocked
                  ? (<>
                      Base permissions are inherited from {form.departments.join(', ')}.
                      As Super Admin you can grant additional access below — these are merged
                      on top of the department defaults.
                    </>)
                  : (<>
                      Granting "Access" only lets this user open the module and view it.
                      Tick individual actions below to allow creating, editing, deleting,
                      importing, exporting, printing, bulk edits, or reports.
                      {isEditingAdmin
                        ? ' As Super Admin, you can grant or restrict this Admin\'s permissions here.'
                        : ' As Super Admin, you can grant or restrict this user\'s permissions here.'}
                    </>)}
              </p>
              <PermissionMatrix
                value={form.permissions}
                onChange={perms => setForm(f => ({ ...f, permissions: perms }))}
                base={basePerms}
                initial={initialPermissions}
                baseLabel={deptLocked ? 'department' : 'default role access'}
              />
              {form.permissions.dailyReport?.access && (
                <div className="dept-daily-report-mode" style={{ marginTop: 14, padding: '10px 12px', background: 'var(--gray-50, #f8fafc)', border: '1.5px solid var(--gray-200)', borderRadius: 8 }}>
                  <strong style={{ fontSize: 13 }}>Daily Report mode</strong>
                  <div className="pm-mode-row">
                    {REPORT_MODES.map(m => (
                      <button
                        key={m.key}
                        type="button"
                        className={`pm-mode-btn ${form.dailyReportMode === m.key ? 'active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, dailyReportMode: m.key }))}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: 12, margin: '6px 0 0' }}>
                    {REPORT_MODES.find(m => m.key === form.dailyReportMode)?.hint}
                    {deptLocked && form.dailyReportMode !== baseMode && ' Differs from the department default for this person.'}
                  </p>

                  {(isEditingAdmin || form.dailyReportMode !== 'write') && (
                    <div style={{ marginTop: 10 }}>
                      <strong style={{ fontSize: 13 }}>Restrict viewing to specific departments</strong>
                      <p style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: 12, margin: '4px 0 8px' }}>
                        Leave unchecked to see every department. Check specific ones to limit to only those.
                      </p>
                      {departments.length === 0 ? (
                        <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>No departments created yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {departments.map(d => {
                            const checked = form.dailyReportDepartments.includes(d.name);
                            return (
                              <label
                                key={d._id}
                                className={`dept-chip ${checked ? 'checked' : ''}`}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 20, fontSize: 12, cursor: 'pointer', background: checked ? 'var(--uca-blue-xlight)' : 'white' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setForm(f => ({
                                    ...f,
                                    dailyReportDepartments: checked
                                      ? f.dailyReportDepartments.filter(n => n !== d.name)
                                      : [...f.dailyReportDepartments, d.name]
                                  }))}
                                />
                                {d.name}
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <p style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: 12, marginTop: 8 }}>
                        {form.dailyReportDepartments.length === 0
                          ? 'Unrestricted — sees every department.'
                          : `Restricted to: ${form.dailyReportDepartments.join(', ')}`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!canEditPermissions && (
            <div className="modal-section">
              <h4>Modules &amp; Permissions</h4>
              <p className="section-hint">
                Module and action permissions are assigned by a Super Admin only.
                {isEdit ? ' This user keeps their current permissions.' : ' This user will start with the default permissions for their role.'}
              </p>
            </div>
          )}

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
