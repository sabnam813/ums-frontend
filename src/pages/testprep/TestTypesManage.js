import React, { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import TestTypeModal from '../../components/testprep/TestTypeModal';
import TestPrepFieldsManager from '../../components/testprep/TestPrepFieldsManager';
import { useTestPrepFieldConfig } from '../../hooks/useTestPrepFieldConfig';
import { useFiscalYear } from '../../context/FiscalYearContext';
import '../admin/ApplicationsList.css';

export default function TestTypesManage() {
  const outletCtx = useOutletContext() || {};
  const isAdmin = outletCtx.isAdmin;
  const { dateFrom, dateTo } = useFiscalYear();

  const [testTypes, setTestTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editType, setEditType] = useState(null);
  const [showFieldsManager, setShowFieldsManager] = useState(false);
  const fieldConfig = useTestPrepFieldConfig();

  const fetchTestTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/test-types', { params: { dateFrom, dateTo } });
      setTestTypes(res.data.testTypes || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load test types');
      setTestTypes([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchTestTypes(); }, [fetchTestTypes]);

  const handleSave = async (data) => {
    try {
      if (editType) {
        await axios.put(`/test-types/${editType._id}`, data);
        toast.success('Test type updated');
      } else {
        await axios.post('/test-types', data);
        toast.success('Test type added');
      }
      setShowModal(false);
      setEditType(null);
      await fetchTestTypes();
      outletCtx.refetchTestTypes?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save test type');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this test type to trash? Its booking records will also be moved to trash. Everything can be restored later from the Trash page.')) return;
    try {
      await axios.delete(`/test-types/${id}`);
      setTestTypes(prev => prev.filter(t => t._id !== id));
      toast.success('Test type moved to trash');
      outletCtx.refetchTestTypes?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete test type');
    }
  };

  const basePath = isAdmin ? '/admin/test-prep' : '/test-prep';

  if (loading) {
    return (
      <div className="dt-loading">
        <div className="dt-spinner" />
        <p>Loading test types…</p>
      </div>
    );
  }

  return (
    <div className="apps-list animate-fade">
      <div className="page-header">
        <div>
          <h2>Test Preparation</h2>
          <p>Manage exam types.</p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-add" style={{ background: 'var(--gray-700, #374151)' }} onClick={() => setShowFieldsManager(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/>
                <path d="M1 14h6M9 8h6M17 16h6"/>
              </svg>
              Manage Fields
            </button>
            <button className="btn-add" onClick={() => { setEditType(null); setShowModal(true); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add Test Type
            </button>
          </div>
        )}
      </div>

      <div className="countries-grid">
        {testTypes.map(t => (
          <div className="country-card" key={t._id}>
            <div className="cc-header">
              <span className="cc-flag tt-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </span>
              {isAdmin && (
                <div className="cc-actions">
                  <button className="icon-btn edit" onClick={() => { setEditType(t); setShowModal(true); }} title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDelete(t._id)} title="Delete">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <h3 className="cc-name">{t.name}</h3>

            <div className="cc-stats">
              <div className="cc-stat">
                <span className="ccs-val">{t.total ?? 0}</span>
                <span className="ccs-lbl">Bookings</span>
              </div>
              <div className="cc-stat">
                <span className="ccs-val" style={{ color: 'var(--green)' }}>{t.paid ?? 0}</span>
                <span className="ccs-lbl">Paid</span>
              </div>
              <div className="cc-stat">
                <span className="ccs-val" style={{ color: 'var(--purple)' }}>{t.directPaid ?? 0}</span>
                <span className="ccs-lbl">Direct Paid</span>
              </div>
              <div className="cc-stat">
                <span className="ccs-val" style={{ color: 'var(--red)' }}>{t.notPaid ?? 0}</span>
                <span className="ccs-lbl">Not Paid</span>
              </div>
              <div className="cc-stat">
                <span className="ccs-val" style={{ color: 'var(--yellow)' }}>{t.pending ?? 0}</span>
                <span className="ccs-lbl">Pending</span>
              </div>
            </div>

            <Link to={`${basePath}/${t.slug}`} className="cc-open-btn">
              Open Bookings
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        ))}

        {isAdmin && (
          <button className="country-card add-card" onClick={() => { setEditType(null); setShowModal(true); }}>
            <div className="add-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <span>Add New Test Type</span>
          </button>
        )}
      </div>

      {testTypes.length === 0 && (
        <div className="apps-empty-hint">No test types yet{isAdmin ? '. Click "Add New Test Type" to get started.' : '.'}</div>
      )}

      {showModal && (
        <TestTypeModal
          testType={editType}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditType(null); }}
        />
      )}

      {showFieldsManager && (
        <TestPrepFieldsManager
          fieldConfig={fieldConfig}
          refetchFields={async () => { await fieldConfig.refetch(); fieldConfig.broadcastChange(); }}
          onClose={() => setShowFieldsManager(false)}
        />
      )}
    </div>
  );
}
