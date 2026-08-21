import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './BackupManager.css';

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
  { name: 'Application',   label: 'Applications' },
  { name: 'Inquiry',       label: 'Inquiries' },
  { name: 'User',          label: 'Users' },
  { name: 'Country',       label: 'Countries' },
  { name: 'FieldConfig',   label: 'Field Config' },
  { name: 'Conversation',  label: 'Conversations' },
  { name: 'Message',       label: 'Messages' },
  { name: 'Trash',         label: 'Trash' },
];

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [exportingCol, setExportingCol] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [validating, setValidating] = useState(false);
  const [restoringUpload, setRestoringUpload] = useState(false);
  const fileInputRef = React.useRef(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/backup');
      setBackups(res.data.backups || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load backups');
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
      setBackups([{ ...res.data.backup, fileAvailable: true }]);
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
      .catch(err => toast.error(err.response?.data?.message || 'Download failed'));
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
    } catch (err) {
      toast.error(`Export failed for ${label}`);
    } finally {
      setExportingCol(null);
    }
  };

  const restoreBackup = async (id) => {
    if (!window.confirm(
      'This will REPLACE ALL current data with this backup\'s contents. Anything created or changed since this backup was taken will be lost. Continue?'
    )) return;
    setBusyId(id);
    try {
      const res = await axios.post(`/backup/${id}/restore`);
      toast.success(res.data.message || 'Restore complete');
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
      toast.error(err.response?.data?.message || 'Failed to delete backup');
    } finally {
      setBusyId(null);
    }
  };

  const resetUpload = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadPreview(null);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setUploadError('Please select a .json backup file.');
      setUploadFile(null);
      return;
    }
    setUploadFile(file);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      let parsed;
      try { parsed = JSON.parse(evt.target.result); }
      catch { setUploadError('This file is not valid JSON. It does not look like a backup file.'); return; }
      setValidating(true);
      try {
        const res = await axios.post('/backup/validate-upload', { data: parsed });
        setUploadPreview({ ...res.data, fileName: file.name, fileSize: file.size, fileModified: file.lastModified ? new Date(file.lastModified) : null, parsed });
      } catch (err) {
        setUploadError(err.response?.data?.message || 'This file could not be validated as a backup.');
      } finally {
        setValidating(false);
      }
    };
    reader.onerror = () => setUploadError('Could not read that file.');
    reader.readAsText(file);
  };

  const restoreFromUpload = async () => {
    if (!uploadPreview?.parsed) return;
    if (!window.confirm(
      'This will REPLACE ALL current data with the contents of the uploaded backup file. ' +
      'A safety backup of the current database will be taken automatically first. Continue?'
    )) return;
    setRestoringUpload(true);
    try {
      const res = await axios.post('/backup/restore-upload', { data: uploadPreview.parsed });
      toast.success(res.data.message || 'Restore complete');
      resetUpload();
      fetchBackups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed. The database was rolled back automatically where possible.');
    } finally {
      setRestoringUpload(false);
    }
  };

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner" /><p>Loading backups…</p></div>
  );

  return (
    <div className="backup-page animate-fade">
      {}
      <div className="page-header">
        <div>
          <h2>Backup &amp; Restore</h2>
          <p>Create and manage database backups. Download as JSON (full restore) or Excel (offline copy). Export individual collections for surgical recovery.</p>
        </div>
        <button className="trash-btn trash-btn-restore" disabled={running} onClick={runBackup}>
          {running ? 'Running…' : 'Backup Now'}
        </button>
      </div>

      {}
      <div className="trash-table-card backup-upload-card">
        <h3 className="backup-upload-title">Export &amp; Download</h3>
        <p className="backup-upload-subtitle">
          Download individual collections as JSON to restore just one feature if only its data is affected.
        </p>

        {}
        <div className="backup-export-section">
          <p className="backup-export-section-label">Individual Collections — JSON</p>
          <div className="backup-collection-grid">
            {EXPORTABLE_COLLECTIONS.map(({ name, label }) => (
              <button
                key={name}
                className="backup-col-btn"
                onClick={() => downloadCollectionJSON(name, label)}
                disabled={exportingCol === name}
              >
                {exportingCol === name ? (
                  <><span className="btn-spinner" /> Exporting…</>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {label}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {}
      <div className="trash-table-card backup-upload-card">
        <h3 className="backup-upload-title">Restore from Uploaded Backup File</h3>
        <p className="backup-upload-subtitle">
          Upload a backup file (.json) from your computer to restore the entire system. A safety
          backup of the current database is created automatically before anything is changed.
        </p>

        <div className="backup-upload-row">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="backup-upload-input"
          />
          {uploadFile && (
            <button className="trash-action-btn delete" onClick={resetUpload}>Clear</button>
          )}
        </div>

        {validating && <p className="backup-upload-status">Validating backup file…</p>}
        {uploadError && <p className="backup-upload-status error">{uploadError}</p>}

        {uploadPreview && (
          <div className="backup-preview">
            <div className="backup-preview-row"><span>File Name</span><strong>{uploadPreview.fileName}</strong></div>
            <div className="backup-preview-row"><span>File Size</span><strong>{formatSize(uploadPreview.fileSize)}</strong></div>
            <div className="backup-preview-row">
              <span>Backup Date</span>
              <strong>{uploadPreview.fileModified ? formatDate(uploadPreview.fileModified) : 'Unknown'}</strong>
            </div>
            <div className="backup-preview-row"><span>Database</span><strong>UMS</strong></div>
            <div className="backup-preview-row">
              <span>Collections Included</span>
              <strong>{uploadPreview.collections.join(', ')}</strong>
            </div>
            <div className="backup-preview-row"><span>Record Count</span><strong>{uploadPreview.recordCount.toLocaleString()}</strong></div>
            <button
              className="trash-btn trash-btn-restore backup-restore-btn"
              disabled={restoringUpload}
              onClick={restoreFromUpload}
            >
              {restoringUpload ? 'Restoring…' : 'Restore This Backup'}
            </button>
          </div>
        )}
      </div>

      {}
      <div className="trash-table-card">
        {backups.length === 0 ? (
          <div className="dt-empty">
            <p>No backups yet. Click "Backup Now" to create the first one.</p>
          </div>
        ) : (
          <table className="trash-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Type</th>
                <th>Size</th>
                <th>Contents</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b._id}>
                  <td>{formatDate(b.createdAt)}</td>
                  <td>
                    <span className={`backup-type-badge ${b.type}`}>
                      {b.type === 'auto' ? 'Automatic' : b.type === 'pre-restore' ? 'Pre-Restore Safety' : 'Manual'}
                    </span>
                  </td>
                  <td>{formatSize(b.sizeBytes)}</td>
                  <td className="backup-counts">
                    {Object.entries(b.counts || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </td>
                  <td>
                    {b.fileAvailable
                      ? <span className="backup-status ok">Available</span>
                      : <span className="backup-status missing">File missing</span>}
                  </td>
                  <td>
                    <div className="trash-actions">
                      <button
                        className="trash-action-btn restore"
                        disabled={!b.fileAvailable}
                        onClick={() => downloadBackup(b._id, b.filename)}
                        title="Download JSON"
                      >
                        Download
                      </button>
                      <button
                        className="trash-action-btn restore"
                        disabled={busyId === b._id || !b.fileAvailable}
                        onClick={() => restoreBackup(b._id)}
                        title="Restore this backup"
                      >
                        Restore
                      </button>
                      <button
                        className="trash-action-btn delete"
                        disabled={busyId === b._id}
                        onClick={() => deleteBackup(b._id)}
                        title="Delete this backup"
                      >
                        Delete
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
