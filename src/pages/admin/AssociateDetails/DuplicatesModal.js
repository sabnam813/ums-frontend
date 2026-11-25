import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import '../TrainingSchedule/TrainingSchedule.css';

export default function DuplicatesModal({ onClose, onMerged }) {
  const [groups, setGroups] = useState(null);
  const [keep, setKeep] = useState({});
  const [busy, setBusy] = useState('');

  const load = () => {
    axios.get('/associate-details/duplicates')
      .then(res => {
        const g = res.data.groups || [];
        setGroups(g);
        const k = {};
        g.forEach((grp, i) => { k[i] = grp[0]._id; });
        setKeep(k);
      })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to scan duplicates');
        setGroups([]);
      });
  };

  useEffect(() => { load(); }, []);

  const merge = async (grp, i) => {
    const keepId = keep[i];
    const names = grp.filter(a => a._id !== keepId).map(a => a.name).join(', ');
    if (!window.confirm(`Merge into the selected record and move these to trash: ${names}?`)) return;
    setBusy(String(i));
    try {
      const res = await axios.post('/associate-details/merge-duplicates', { keepId, mergeIds: grp.map(a => a._id).filter(id => id !== keepId) });
      toast.success(`Merged ${res.data.merged}, relinked ${res.data.relinked} record(s)`);
      onMerged();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Merge failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="ts-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ts-modal animate-fade">
        <div className="ts-modal-header">
          <div className="ts-title-group">
            <div>
              <h3>Duplicate Consultancies</h3>
              <p>Same consultancy listed more than once</p>
            </div>
          </div>
          <button type="button" className="ts-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="ts-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {groups === null && <div className="ts-empty-hint">Scanning…</div>}
          {groups && groups.length === 0 && <div className="ts-empty-hint">No duplicates found.</div>}
          {groups && groups.map((grp, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              {grp.map(a => (
                <label key={a._id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', fontSize: '0.85rem' }}>
                  <input type="radio" name={`keep-${i}`} checked={keep[i] === a._id} onChange={() => setKeep(k => ({ ...k, [i]: a._id }))} />
                  <span>
                    <strong>{a.name}</strong> <small>({a.status}{a.location ? `, ${a.location}` : ''})</small>
                    {a.owners && <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{a.owners}</div>}
                  </span>
                </label>
              ))}
              <div style={{ marginTop: 8 }}>
                <button className="ts-btn-save" onClick={() => merge(grp, i)} disabled={busy === String(i)}>
                  {busy === String(i) ? 'Merging…' : 'Keep selected and merge'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="ts-modal-footer">
          <button type="button" className="ts-btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
