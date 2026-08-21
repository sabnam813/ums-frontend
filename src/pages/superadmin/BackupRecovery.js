import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading } from '../../components/superadmin/SuperAdminUI';

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const EXPORTABLE_COLLECTIONS = [
  { name: 'Application',  label: 'Applications' },
  { name: 'Inquiry',      label: 'Inquiries' },
  { name: 'User',         label: 'Users' },
  { name: 'Country',      label: 'Countries' },
  { name: 'FieldConfig',  label: 'Field Config' },
  { name: 'Conversation', label: 'Conversations' },
  { name: 'Message',      label: 'Messages' },
  { name: 'Trash',        label: 'Trash' },
];

const S = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 },
  cardTitle: { fontSize: '1rem', fontWeight: 700, marginBottom: 6, color: 'var(--gray-800)' },
  cardSub: { fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 14 },
  exportRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' },
  exportInfo: { display: 'flex', flexDirection: 'column', gap: 3 },
  exportLabel: { fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 },
  exportDesc: { fontSize: '0.78rem', color: 'var(--gray-500)' },
  colGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  colBtn: { padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--gray-50)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 },
  sectionLabel: { fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-400)', marginTop: 14, marginBottom: 2 },
  uploadRow: { display: 'flex', alignItems: 'center', gap: 10 },
  uploadInput: { flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' },
  statusMsg: { fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: 6 },
  statusErr: { fontSize: '0.85rem', color: 'var(--red)', marginTop: 6 },
  preview: { background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 },
  previewRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' },
  previewKey: { color: 'var(--gray-500)' },
  previewVal: { fontWeight: 600, color: 'var(--gray-800)', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' },
  typeBadgeAuto: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1e40af' },
  typeBadgeManual: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#fef9c3', color: '#92400e' },
  typeBadgePreRestore: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' },
  statusOk: { fontSize: '0.78rem', fontWeight: 600, color: '#16a34a' },
  statusMissing: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--red)' },
  counts: { fontSize: '0.78rem', color: 'var(--gray-500)', maxWidth: 260 },
  actionsCell: { display: 'flex', gap: 6 },
};

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

export default function BackupRecovery() {
  const [backups, setBackups] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [exportingCol, setExportingCol] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [validating, setValidating] = useState(false);
  const [restoringUpload, setRestoringUpload] = useState(false);
  const fileInputRef = useRef(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/backup');
      setBackups(res.data.backups || []);
      setCollections(res.data.collections || []);
    } catch {
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  const runBackup = async () => {
    setRunning(true);
    try {
      const res = await axios.post('/backup/run');
      toast.success('Backup created successfully');
      setBackups(prev => [{ ...res.data.backup, fileAvailable: true }, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Backup failed');
    } finally {
      setRunning(false);
    }
  };

  const downloadBlob = (blobData, filename, mime) => {
    const url = window.URL.createObjectURL(new Blob([blobData], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadBackup = (id, filename) => {
    axios.get(`/backup/${id}/download`, { responseType: 'blob' })
      .then(res => downloadBlob(res.data, filename || 'backup.json', 'application/json'))
      .catch(() => toast.error('Download failed'));
  };

  const downloadCollectionJSON = async (collectionName, label) => {
    setExportingCol(collectionName);
    try {
      const res = await axios.get(`/backup/export/collection/${collectionName}`, { responseType: 'blob' });
      const contentDisp = res.headers['content-disposition'] || '';
      const match = contentDisp.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `${collectionName.toLowerCase()}-export.json`;
      downloadBlob(res.data, filename, 'application/json');
      toast.success(`${label} exported`);
    } catch {
      toast.error(`Export failed for ${label}`);
    } finally {
      setExportingCol(null);
    }
  };

  const restoreBackup = async (id) => {
    if (!window.confirm('This will REPLACE ALL current data with this backup snapshot. Continue?')) return;
    setBusyId(id);
    try {
      await axios.post(`/backup/${id}/restore`);
      toast.success('Restore complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed');
    } finally {
      setBusyId(null);
    }
  };

  const deleteBackup = async (id) => {
    if (!window.confirm('Delete this backup file permanently?')) return;
    setBusyId(id);
    try {
      await axios.delete(`/backup/${id}`);
      toast.success('Backup deleted');
      setBackups(prev => prev.filter(b => b._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const resetUpload = () => {
    setUploadFile(null); setUploadPreview(null); setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(''); setUploadPreview(null);
    if (!file.name.toLowerCase().endsWith('.json')) {
      setUploadError('Please select a .json backup file.'); setUploadFile(null); return;
    }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let parsed;
      try { parsed = JSON.parse(evt.target.result); }
      catch { setUploadError('Not valid JSON — this does not look like a backup file.'); return; }
      setValidating(true);
      try {
        const res = await axios.post('/backup/validate-upload', { data: parsed });
        setUploadPreview({ ...res.data, fileName: file.name, fileSize: file.size, fileModified: file.lastModified ? new Date(file.lastModified) : null, parsed });
      } catch (err) {
        setUploadError(err.response?.data?.message || 'File could not be validated as a backup.');
      } finally { setValidating(false); }
    };
    reader.onerror = () => setUploadError('Could not read that file.');
    reader.readAsText(file);
  };

  const restoreFromUpload = async () => {
    if (!uploadPreview?.parsed) return;
    if (!window.confirm('This will REPLACE ALL current data with the uploaded backup. A safety backup is created automatically first. Continue?')) return;
    setRestoringUpload(true);
    try {
      const res = await axios.post('/backup/restore-upload', { data: uploadPreview.parsed });
      toast.success(res.data.message || 'Restore complete');
      resetUpload(); fetchBackups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed. Database was rolled back.');
    } finally { setRestoringUpload(false); }
  };

  const typeBadgeStyle = (type) => {
    if (type === 'auto') return S.typeBadgeAuto;
    if (type === 'pre-restore') return S.typeBadgePreRestore;
    return S.typeBadgeManual;
  };

  const typeBadgeLabel = (type) => {
    if (type === 'auto') return 'Automatic';
    if (type === 'pre-restore') return 'Pre-Restore Safety';
    return 'Manual';
  };

  return (
    <div>
      <PageHeader
        title="Backup & Recovery"
        subtitle={`Snapshots cover: ${collections.join(', ') || 'core collections'}`}
        actions={
          <button className="sa-btn sa-btn-primary" onClick={runBackup} disabled={running}>
            {running ? 'Creating…' : 'Create Backup Now'}
          </button>
        }
      />

      {loading ? <Loading /> : (
        <>
          {}
          <div style={S.card}>
            <div style={S.cardTitle}>Export &amp; Download</div>
            <div style={S.cardSub}>
              Export individual collections as JSON for surgical recovery.
            </div>

            <div style={S.sectionLabel}>Individual Collections — JSON</div>
            <div style={S.colGrid}>
              {EXPORTABLE_COLLECTIONS.map(({ name, label }) => (
                <button key={name} style={{ ...S.colBtn, opacity: exportingCol === name ? 0.6 : 1 }} onClick={() => downloadCollectionJSON(name, label)} disabled={exportingCol === name}>
                  <DownloadIcon /> {exportingCol === name ? 'Exporting…' : label}
                </button>
              ))}
            </div>
          </div>

          {}
          <div style={S.card}>
            <div style={S.cardTitle}>Restore from Uploaded Backup</div>
            <div style={S.cardSub}>Upload a .json backup file to restore the entire system. A safety backup is created automatically before anything changes.</div>
            <div style={S.uploadRow}>
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileSelect} style={S.uploadInput} />
              {uploadFile && <button className="sa-btn" onClick={resetUpload}>Clear</button>}
            </div>
            {validating && <div style={S.statusMsg}>Validating backup file…</div>}
            {uploadError && <div style={S.statusErr}>{uploadError}</div>}
            {uploadPreview && (
              <div style={S.preview}>
                <div style={S.previewRow}><span style={S.previewKey}>File</span><span style={S.previewVal}>{uploadPreview.fileName}</span></div>
                <div style={S.previewRow}><span style={S.previewKey}>Size</span><span style={S.previewVal}>{formatSize(uploadPreview.fileSize)}</span></div>
                <div style={S.previewRow}><span style={S.previewKey}>Collections</span><span style={S.previewVal}>{uploadPreview.collections.join(', ')}</span></div>
                <div style={S.previewRow}><span style={S.previewKey}>Records</span><span style={S.previewVal}>{uploadPreview.recordCount.toLocaleString()}</span></div>
                <button className="sa-btn sa-btn-danger" disabled={restoringUpload} onClick={restoreFromUpload} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                  {restoringUpload ? 'Restoring…' : 'Restore This Backup'}
                </button>
              </div>
            )}
          </div>

          {}
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Created</th><th>Type</th><th>Size</th><th>Contents</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 && (
                  <tr><td colSpan={6} className="sa-empty-row">No backups yet. Click "Create Backup Now" to create the first one.</td></tr>
                )}
                {backups.map(b => (
                  <tr key={b._id}>
                    <td>{formatDate(b.createdAt)}</td>
                    <td><span style={typeBadgeStyle(b.type)}>{typeBadgeLabel(b.type)}</span></td>
                    <td>{formatSize(b.sizeBytes)}</td>
                    <td style={S.counts}>{Object.entries(b.counts || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}</td>
                    <td>
                      {b.fileAvailable
                        ? <span style={S.statusOk}>Available</span>
                        : <span style={S.statusMissing}>File missing</span>}
                    </td>
                    <td>
                      <div style={S.actionsCell}>
                        <button className="sa-btn" disabled={!b.fileAvailable} onClick={() => downloadBackup(b._id, b.filename)}>Download</button>
                        <button className="sa-btn" disabled={busyId === b._id || !b.fileAvailable} onClick={() => restoreBackup(b._id)}>
                          {busyId === b._id ? 'Restoring…' : 'Restore'}
                        </button>
                        <button className="sa-btn sa-btn-danger" disabled={busyId === b._id} onClick={() => deleteBackup(b._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
