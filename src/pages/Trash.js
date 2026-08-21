import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin as checkIsSuperAdmin } from '../utils/permissions';
import './Trash.css';

const MODEL_LABELS = {
  Application: 'Application',
  Inquiry: 'Inquiry',
  Country: 'Country',
  User: 'User',
  FieldConfig: 'Custom Field',
  TestType: 'Test Type',
  TestPrepRecord: 'Test Prep Record',
  TestPrepFieldConfig: 'Test Prep Custom Field',
  Contact: 'Contact',
  ContactGroup: 'Contact Group',
  CountryGroup: 'Country Group',
  Portal: 'Portal',
  Diary: 'Diary',
};

function summarize(item) {
  const d = item.data || {};
  switch (item.model) {
    case 'Application':
      return d.name || item.meta?.name || 'Unnamed applicant';
    case 'Inquiry':
      return d.applicantName || item.meta?.applicantName || 'Unnamed inquiry';
    case 'Country':
      return `${d.flag || ''} ${d.name || item.meta?.name || ''}`.trim() || 'Unnamed country';
    case 'User':
      return d.name || d.username || item.meta?.username || 'Unnamed user';
    case 'FieldConfig':
      return d.label || item.meta?.label || 'Unnamed field';
    case 'TestPrepFieldConfig':
      return d.label || item.meta?.label || 'Unnamed field';
    case 'Contact': {
      const firstValue = d.data && typeof d.data === 'object' ? Object.values(d.data)[0] : null;
      return firstValue || 'Unnamed contact';
    }
    case 'ContactGroup':
      return d.name || item.meta?.name || 'Unnamed contact group';
    case 'CountryGroup':
      return d.name || item.meta?.name || 'Unnamed country group';
    case 'Portal':
      return d.name || item.meta?.name || 'Unnamed portal';
    case 'Diary':
      return d.name || item.meta?.name || 'Unnamed diary entry';
    default:
      return item.originalId;
  }
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Trash() {
  const { user } = useAuth();
  const isSuperAdmin = checkIsSuperAdmin(user);
  const canManage = isSuperAdmin;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/trash');
      setItems(res.data.items || []);
    } catch (err) {
      toast.error('Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(i => i.model === filter);
  }, [items, filter]);

  const availableModels = useMemo(() => {
    const set = new Set(items.map(i => i.model));
    return Array.from(set);
  }, [items]);

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map(i => i._id));
  };

  const restoreOne = async (id) => {
    setBusy(true);
    try {
      const res = await axios.post(`/trash/${id}/restore`);
      toast.success(res.data.message || 'Restored');
      setItems(prev => prev.filter(i => i._id !== id));
      setSelected(prev => prev.filter(x => x !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore');
    } finally {
      setBusy(false);
    }
  };

  const deleteOne = async (id) => {
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    setBusy(true);
    try {
      await axios.delete(`/trash/${id}`);
      toast.success('Permanently deleted');
      setItems(prev => prev.filter(i => i._id !== id));
      setSelected(prev => prev.filter(x => x !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  const bulkRestore = async () => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const res = await axios.post('/trash/bulk/restore', { ids: selected });
      toast.success(`Restored ${res.data.restored} item(s)`);
      setItems(prev => prev.filter(i => !selected.includes(i._id)));
      setSelected([]);
    } catch (err) {
      toast.error('Bulk restore failed');
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Permanently delete ${selected.length} item(s)? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await axios.delete('/trash/bulk/delete', { data: { ids: selected } });
      toast.success(`Permanently deleted ${res.data.deleted} item(s)`);
      setItems(prev => prev.filter(i => !selected.includes(i._id)));
      setSelected([]);
    } catch (err) {
      toast.error('Bulk delete failed');
    } finally {
      setBusy(false);
    }
  };

  const emptyAll = async () => {
    if (!window.confirm('Empty the ENTIRE trash bin for all users? This permanently deletes everything in it and cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await axios.delete('/trash/admin/empty-all');
      toast.success(res.data.message || 'Trash emptied');
      setItems([]);
      setSelected([]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to empty trash');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner" /><p>Loading trash…</p></div>
  );

  return (
    <div className="trash-page animate-fade">
      <div className="page-header">
        <div>
          <h2>Trash</h2>
          <p>
            {canManage
              ? 'Deleted items are kept here for 60 days. Restore or permanently delete them anytime.'
              : 'Deleted items from your assigned countries. Only a Super Admin can restore or permanently delete items.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.length > 0 && canManage && (
            <>
              <button className="trash-btn trash-btn-restore" disabled={busy} onClick={bulkRestore}>
                Restore ({selected.length})
              </button>
              <button className="trash-btn trash-btn-danger" disabled={busy} onClick={bulkDelete}>
                Delete Forever ({selected.length})
              </button>
            </>
          )}
          {canManage && items.length > 0 && (
            <button className="trash-btn trash-btn-outline" disabled={busy} onClick={emptyAll}>
              Empty Trash
            </button>
          )}
        </div>
      </div>

      {availableModels.length > 1 && (
        <div className="trash-filters">
          <button className={`trash-filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            All ({items.length})
          </button>
          {availableModels.map(m => (
            <button key={m} className={`trash-filter-chip ${filter === m ? 'active' : ''}`} onClick={() => setFilter(m)}>
              {MODEL_LABELS[m] || m} ({items.filter(i => i.model === m).length})
            </button>
          ))}
        </div>
      )}

      <div className="trash-table-card">
        {filtered.length === 0 ? (
          <div className="dt-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <p>Trash is empty</p>
          </div>
        ) : (
          <table className="trash-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} />
                </th>
                <th>Item</th>
                <th>Type</th>
                <th>Deleted By</th>
                <th>Deleted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item._id}>
                  <td>
                    <input type="checkbox" checked={selected.includes(item._id)} onChange={() => toggleSelect(item._id)} />
                  </td>
                  <td className="trash-item-name">{summarize(item)}</td>
                  <td><span className="trash-type-badge">{MODEL_LABELS[item.model] || item.model}</span></td>
                  <td>{item.deletedByName || '—'}</td>
                  <td title={new Date(item.createdAt).toLocaleString()}>{timeAgo(item.createdAt)}</td>
                  <td>
                    <div className="trash-actions">
                      <button className="trash-action-btn restore" disabled={busy || !canManage} onClick={() => canManage ? restoreOne(item._id) : null} title={canManage ? "Restore" : "Only Super Admins can restore items"}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" />
                        </svg>
                        Restore
                      </button>
                      <button className="trash-action-btn delete" disabled={busy || !canManage} onClick={() => canManage ? deleteOne(item._id) : null} title={canManage ? "Delete forever" : "Only Super Admins can permanently delete items"}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                        Delete Forever
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
