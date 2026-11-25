import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from 'react-select';
import PermissionMatrix from '../../components/shared/PermissionMatrix';
import { MODULES, ACTIONS, REPORT_MODES } from '../../utils/rbac';
import './Departments.css';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadedKey = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState('');

  const fetchAll = useCallback(async () => {
    if (loadedKey.current !== 'all') setLoading(true);
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
      loadedKey.current = 'all';
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

  const q = query.trim().toLowerCase();
  const visibleDepts = !q ? departments : departments.filter(d => {
    const cn = (d.countries || []).map(c => (c && c.name) || '');
    const hay = [d.name, ...cn].filter(Boolean).join(' ').toLowerCase();
    return q.split(/\s+/).every(t => hay.includes(t));
  });

  if (loading) return (
    <div className="ui-loading"><div className="ui-spinner" /><p>Loading departments…</p></div>
  );

  return (
    <div className="dept-page animate-fade">
      <div className="ui-page-head">
        <div>
          <h2>Department Management</h2>
        </div>
        <button className="ui-btn ui-btn-primary" onClick={() => { setEditDept(null); setShowModal(true); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Department
        </button>
      </div>

      <div className="list-search ui-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search department or country" />
        {query && <button type="button" className="list-search-clear" onClick={() => setQuery('')}>&times;</button>}
      </div>

      {departments.length === 0 ? (
        <div className="ui-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          <p>No departments yet.</p>
        </div>
      ) : visibleDepts.length === 0 ? (
        <div className="ui-empty">
          <p>No departments match your search.</p>
        </div>
      ) : (
        <div className="ui-grid">
          {visibleDepts.map(dept => (
            <div key={dept._id} className="ui-card">
              <div className="ui-card-head">
                <div className="ui-card-title">
                  <div className="ui-avatar">{dept.name[0].toUpperCase()}</div>
                  <div>
                    <h3>{dept.name}</h3>
                    <span className="ui-card-sub">
                      {dept.allCountries
                        ? 'All countries'
                        : dept.countries?.length > 0
                          ? `${dept.countries.length} countr${dept.countries.length !== 1 ? 'ies' : 'y'}`
                          : 'No country assigned'}
                    </span>
                  </div>
                </div>
                <div className="ui-card-actions">
                  <button
                    className="ui-icon-btn"
                    title="Edit department"
                    onClick={() => { setEditDept(dept); setShowModal(true); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className="ui-icon-btn danger"
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

              <div className="ui-tags">
                {MODULES.map(({ key, label }) => {
                  const hasPerm = dept.permissions?.[key]?.access;
                  return (
                    <span key={key} className={`ui-chip ${hasPerm ? 'on' : 'off'}`}>
                      {label}
                    </span>
                  );
                })}
                {dept.permissions?.dailyReport?.access && (
                  <span
                    className={`ui-chip ${(dept.dailyReportMode || (dept.dailyReportViewOnly ? 'view' : 'write')) !== 'write' ? 'on' : 'off'}`}
                    title="Whether staff in this department write their own daily report or only view everyone's reports"
                  >
                    {`Daily Report: ${({ view: 'View Only', both: 'Write + View', write: 'Write' })[dept.dailyReportMode || (dept.dailyReportViewOnly ? 'view' : 'write')]}`}
                  </span>
                )}
              </div>

              {dept.countries?.length > 0 && !dept.allCountries && (
                <div className="ui-tags">
                  {dept.countries.slice(0, 4).map(c => (
                    <span key={c._id} className="ui-tag">
                      {c.flag} {c.name}
                    </span>
                  ))}
                  {dept.countries.length > 4 && (
                    <span className="ui-tag ui-tag-muted">+{dept.countries.length - 4} more</span>
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
          allDepartments={departments}
          onSave={async (data) => {
            try {
              let res;
              if (editDept) {
                if (!window.confirm('Save changes to this department?')) return;
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

function DepartmentModal({ dept, countryOptions, allDepartments = [], onSave, onClose }) {
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
  const [dailyReportMode, setDailyReportMode] = useState(dept?.dailyReportMode || (dept?.dailyReportViewOnly ? 'view' : 'write'));
  const initialPermissions = React.useMemo(() => permissions, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [dailyReportDepartments, setDailyReportDepartments] = useState(dept?.dailyReportDepartments || []);
  const [nameError, setNameError] = useState('');

  const effectiveCountryOptions = React.useMemo(() => {
    const known = new Set(countryOptions.map(o => o.value));
    const missing = selectedCountries.filter(sc => !known.has(sc.value));
    return missing.length > 0 ? [...countryOptions, ...missing] : countryOptions;
  }, [countryOptions, selectedCountries]);

  const handleSubmit = () => {
    if (!name.trim()) { setNameError('Department name is required'); return; }
    onSave({
      name: name.trim(),
      permissions,
      countries: allCountries ? [] : selectedCountries.map(c => c.value),
      allCountries,
      dailyReportMode,
      dailyReportDepartments,
    });
  };

  return (
    <div className="ui-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ui-modal ui-modal-wide">
        <div className="ui-modal-head">
          <div className="ui-modal-titles">
            <div className="ui-modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Department' : 'Create Department'}</h3>
            </div>
          </div>
          <button className="ui-modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="ui-modal-body">
          <div className="ui-modal-section">
            <h4>Department Info</h4>
            <div className={`ui-field ${nameError ? 'has-error' : ''}`}>
              <label>Department Name *</label>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={e => { setName(e.target.value); setNameError(''); }}
              />
              {nameError && <span className="ui-field-error">{nameError}</span>}
            </div>
          </div>

          <div className="ui-modal-section">
            <h4>Country Access</h4>
            <label className="ui-check-row">
              <input type="checkbox" checked={allCountries} onChange={e => setAllCountries(e.target.checked)} />
              <span>Access to all countries</span>
            </label>
            {!allCountries && (
              <div className="ui-field" style={{ marginTop: 12 }}>
                <label>Assigned Countries</label>
                <Select
                  isMulti
                  className="custom-select"
                  classNamePrefix="react-select"
                  options={effectiveCountryOptions}
                  value={selectedCountries}
                  onChange={opts => setSelectedCountries(opts || [])}
                  placeholder="Countries"
                />
              </div>
            )}
          </div>

          <div className="ui-modal-section">
            <h4>Module Permissions</h4>
            <PermissionMatrix
              value={permissions}
              onChange={setPermissions}
              initial={isEdit ? initialPermissions : undefined}
              baseLabel="department"
            />

            {permissions.dailyReport?.access && (
              <div className="ui-mode-box">
                <strong>Daily Report mode</strong>
                <div className="ui-mode-row">
                  {REPORT_MODES.map(m => (
                    <button
                      key={m.key}
                      type="button"
                      className={`ui-mode-btn ${dailyReportMode === m.key ? 'active' : ''}`}
                      onClick={() => setDailyReportMode(m.key)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {dailyReportMode !== 'write' && (
                  <div className="ui-chip-block">
                    <strong>Visible departments</strong>
                    {allDepartments.filter(d => d._id !== dept?._id).length === 0 ? (
                      <span className="ui-muted">No other departments</span>
                    ) : (
                      <div className="ui-chip-row">
                        {allDepartments.filter(d => d._id !== dept?._id).map(d => {
                          const checked = dailyReportDepartments.includes(d.name);
                          return (
                            <label key={d._id} className={`ui-chip-check ${checked ? 'on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setDailyReportDepartments(prev => checked
                                  ? prev.filter(n => n !== d.name)
                                  : [...prev, d.name])}
                              />
                              {d.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="ui-modal-foot">
          <button className="ui-btn ui-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ui-btn ui-btn-primary" onClick={handleSubmit}>
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
