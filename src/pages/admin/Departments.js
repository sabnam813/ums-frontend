import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from 'react-select';
import { MODULES, ACTIONS } from '../../utils/rbac';
import './Departments.css';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        axios.get('/departments'),
        axios.get('/countries'),
      ]);
      setDepartments(dRes.data.departments || []);
      setCountries(cRes.data.countries || []);
    } catch (err) {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (dept) => {
    if (!window.confirm(`Delete department "${dept.name}"? This cannot be undone.`)) return;
    setDeleting(dept._id);
    try {
      await axios.delete(`/departments/${dept._id}`);
      setDepartments(prev => prev.filter(d => d._id !== dept._id));
      toast.success(`Department "${dept.name}" deleted`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete department');
    } finally {
      setDeleting(null);
    }
  };

  const countryOptions = countries.map(c => ({
    value: c._id, label: `${c.flag || ''} ${c.name}`.trim()
  }));

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner" /><p>Loading departments…</p></div>
  );

  return (
    <div className="dept-page animate-fade">
      <div className="page-header">
        <div>
          <h2>Department Management</h2>
          <p>Create departments with permissions and country access. Users inherit these settings automatically.</p>
        </div>
        <button className="btn-add" onClick={() => { setEditDept(null); setShowModal(true); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Department
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="dept-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          <p>No departments yet.</p>
          <span>Click "Add Department" to create your first one.</span>
        </div>
      ) : (
        <div className="dept-grid">
          {departments.map(dept => (
            <div key={dept._id} className="dept-card">
              <div className="dept-card-header">
                <div className="dept-card-title">
                  <div className="dept-icon">{dept.name[0].toUpperCase()}</div>
                  <div>
                    <h3>{dept.name}</h3>
                    <span className="dept-country-count">
                      {dept.allCountries
                        ? 'All countries'
                        : dept.countries?.length > 0
                          ? `${dept.countries.length} countr${dept.countries.length !== 1 ? 'ies' : 'y'}`
                          : 'No country assigned'}
                    </span>
                  </div>
                </div>
                <div className="dept-card-actions">
                  <button
                    className="icon-btn edit"
                    title="Edit department"
                    onClick={() => { setEditDept(dept); setShowModal(true); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete department"
                    onClick={() => handleDelete(dept)}
                    disabled={deleting === dept._id}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="dept-perm-summary">
                {MODULES.map(({ key, label }) => {
                  const hasPerm = dept.permissions?.[key]?.access;
                  return (
                    <span key={key} className={`dept-perm-chip ${hasPerm ? 'active' : 'inactive'}`}>
                      {label}
                    </span>
                  );
                })}
              </div>

              {dept.countries?.length > 0 && !dept.allCountries && (
                <div className="dept-countries">
                  {dept.countries.slice(0, 4).map(c => (
                    <span key={c._id} className="dept-country-tag">
                      {c.flag} {c.name}
                    </span>
                  ))}
                  {dept.countries.length > 4 && (
                    <span className="dept-country-tag dept-more">+{dept.countries.length - 4} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <DepartmentModal
          dept={editDept}
          countryOptions={countryOptions}
          onSave={async (data) => {
            try {
              let res;
              if (editDept) {
                res = await axios.put(`/departments/${editDept._id}`, data);
                setDepartments(prev => prev.map(d => d._id === editDept._id ? res.data.department : d));
                toast.success('Department updated');
              } else {
                res = await axios.post('/departments', data);
                setDepartments(prev => [...prev, res.data.department]);
                toast.success('Department created');
              }
              setShowModal(false); setEditDept(null);
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to save department');
            }
          }}
          onClose={() => { setShowModal(false); setEditDept(null); }}
        />
      )}
    </div>
  );
}

function DepartmentModal({ dept, countryOptions, onSave, onClose }) {
  const isEdit = !!dept;
  const [name, setName] = useState(dept?.name || '');
  const [allCountries, setAllCountries] = useState(dept?.allCountries || false);
  const [selectedCountries, setSelectedCountries] = useState(
    (dept?.countries || []).map(c => ({ value: c._id || c, label: `${c.flag || ''} ${c.name || c}`.trim() }))
  );
  const [permissions, setPermissions] = useState(() => {
    const perms = {};
    MODULES.forEach(({ key }) => {
      const ex = dept?.permissions?.[key] || {};
      perms[key] = {};
      ACTIONS.forEach(({ key: a }) => { perms[key][a] = !!ex[a]; });
    });
    return perms;
  });
  const [nameError, setNameError] = useState('');

  const toggleAccess = (moduleKey, checked) => {
    setPermissions(p => {
      const mp = { ...p[moduleKey], access: checked };
      if (!checked) ACTIONS.forEach(({ key: a }) => { if (a !== 'access') mp[a] = false; });
      return { ...p, [moduleKey]: mp };
    });
  };
  const toggleAction = (moduleKey, actionKey, checked) => {
    setPermissions(p => ({ ...p, [moduleKey]: { ...p[moduleKey], [actionKey]: checked } }));
  };

  const handleSubmit = () => {
    if (!name.trim()) { setNameError('Department name is required'); return; }
    onSave({
      name: name.trim(),
      permissions,
      countries: allCountries ? [] : selectedCountries.map(c => c.value),
      allCountries,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade dept-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Department' : 'Create Department'}</h3>
              <p>{isEdit ? 'Update name, permissions, and country access' : 'Set up a new department with permissions'}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-form dept-modal-body">
          <div className="modal-section">
            <h4>Department Info</h4>
            <div className={`field ${nameError ? 'has-error' : ''}`}>
              <label>Department Name *</label>
              <input
                type="text"
                placeholder="e.g. IT, HR, Australia…"
                value={name}
                onChange={e => { setName(e.target.value); setNameError(''); }}
              />
              {nameError && <span className="field-error">{nameError}</span>}
            </div>
          </div>

          <div className="modal-section">
            <h4>Country Access</h4>
            <label className="dept-checkbox-row">
              <input type="checkbox" checked={allCountries} onChange={e => setAllCountries(e.target.checked)} />
              <span>Access to all countries</span>
            </label>
            {!allCountries && (
              <div className="field" style={{ marginTop: 10 }}>
                <label>Assigned Countries</label>
                <Select
                  isMulti
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={countryOptions}
                  value={selectedCountries}
                  onChange={opts => setSelectedCountries(opts || [])}
                  placeholder="Select countries…"
                />
              </div>
            )}
          </div>

          <div className="modal-section">
            <h4>Module Permissions</h4>
            <p className="section-hint">These permissions will be automatically inherited by all users in this department.</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="permission-matrix" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1.5px solid var(--gray-200)' }}>Module</th>
                    {ACTIONS.map(a => (
                      <th key={a.key} style={{ padding: '6px 6px', borderBottom: '1.5px solid var(--gray-200)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {a.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(({ key: moduleKey, label }) => {
                    const mp = permissions[moduleKey] || {};
                    const hasAccess = !!mp.access;
                    return (
                      <tr key={moduleKey}>
                        <td style={{ padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</td>
                        {ACTIONS.map(({ key: actionKey }) => (
                          <td key={actionKey} style={{ textAlign: 'center', padding: '4px 6px' }}>
                            <input
                              type="checkbox"
                              checked={!!mp[actionKey]}
                              disabled={actionKey !== 'access' && !hasAccess}
                              onChange={e => actionKey === 'access'
                                ? toggleAccess(moduleKey, e.target.checked)
                                : toggleAction(moduleKey, actionKey, e.target.checked)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSubmit}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            {isEdit ? 'Save Changes' : 'Create Department'}
          </button>
        </div>
      </div>
    </div>
  );
}
