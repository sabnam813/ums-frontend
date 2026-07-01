import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import './BulkImportModal.css';

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const BUILTIN_FIELDS = [
  { key: 'date', label: 'Date', aliases: ['applicationdate', 'dateofapplication'] },
  { key: 'referredBy', label: 'Referred By', aliases: ['referredby', 'referral', 'referrer'] },
  { key: 'name', label: 'Name', aliases: ['applicantname', 'studentname', 'nameofapplicant'] },
  { key: 'level', label: 'Level', aliases: ['programlevel', 'studylevel'] },
  { key: 'course', label: 'Course', aliases: ['programme', 'program', 'courseofstudy'] },
  { key: 'providerName', label: 'Provider Name', aliases: ['provider', 'institution', 'university', 'college'] },
  { key: 'initialIntake', label: 'Initial Intake', aliases: ['intake', 'initialintakedate', 'intakeinitial'] },
  { key: 'deferredIntake', label: 'Deferred Intake', aliases: ['deferredintakedate', 'deferral', 'deferred'] },
  { key: 'gsSubmission', label: 'GS Submission', aliases: ['gs', 'gssubmission', 'genuinestudent'] },
  { key: 'olRequest', label: 'OL Request', aliases: ['olrequest', 'offerletterrequest'] },
  { key: 'offerLetter', label: 'OL Received', aliases: ['offer', 'offerletter', 'i20', 'olreceived'] },
  { key: 'withdraw', label: 'Withdraw', aliases: ['withdrawn', 'applicationwithdraw'] },
  { key: 'coeCas', label: 'COE/CAS', aliases: ['coe', 'cas', 'coecas'] },
  { key: 'payment', label: 'Payment Status', aliases: ['payment', 'paymentstatus'] },
  { key: 'visaLodgement', label: 'Visa Date', aliases: ['visalodgementdate', 'visalodge', 'visadate'] },
  { key: 'visaOutcome', label: 'Visa Outcome', aliases: ['visaresult', 'visastatus'] },
  { key: 'visaWithdraw', label: 'Visa Withdraw', aliases: ['visawithdrawn'] },
  { key: 'savisFee', label: 'Savis Fee', aliases: ['savis', 'savisfeestatus', 'sevisfee'] },
  { key: 'refund', label: 'Refund', aliases: ['refundstatus'] },
  { key: 'remarks', label: 'Remarks', aliases: ['notes', 'comments', 'remark'] },
  { key: 'other', label: 'Other', aliases: ['others', 'otherinfo', 'otherinformation'] },
  { key: 'through', label: 'Through', aliases: ['channel', 'subagent', 'source'] },
];


export default function BulkImportModal({
  isOpen,
  onClose,
  onImport,
  loading = false,
  title = 'Bulk Import',
  fields = null,
  customFields = [],
  requiredField = { key: 'name', label: 'Name' },
  dateFields = ['date', 'visaLodgement'],
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [headerMapping, setHeaderMapping] = useState({});
  const [step, setStep] = useState(1);

  const importTargets = useMemo(() => {
    const base = (fields || BUILTIN_FIELDS).map(f => ({ value: f.key, label: f.label, aliases: f.aliases || [] }));
    const customs = customFields.map(f => ({
      value: `custom:${f.key}`,
      label: f.label,
      aliases: [f.key],
    }));
    return [...base, ...customs];
  }, [fields, customFields]);

  const findBestMatch = (header) => {
    const n = normalize(header);
    if (!n) return '';
    let match = importTargets.find(t => normalize(t.label) === n || t.aliases.some(a => normalize(a) === n));
    if (match) return match.value;
    match = importTargets.find(t => normalize(t.label).includes(n) || n.includes(normalize(t.label)));
    if (match) return match.value;
    return '';
  };

  const resetState = () => {
    setSelectedFile(null);
    setColumns([]);
    setAllRows([]);
    setHeaderMapping({});
    setStep(1);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx?|csv)$/)) {
      toast.error('Please select an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setSelectedFile(file);
    parseExcel(file);
  };

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        
        const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });

        if (!grid || grid.length === 0) {
          toast.error('File is empty');
          return;
        }

        const headerRow = grid[0] || [];
        const dataRows = grid.slice(1).filter(r => r.some(c => c !== '' && c !== undefined && c !== null));

        if (dataRows.length === 0) {
          toast.error('No data rows found below the header row');
          return;
        }


        const colCount = Math.max(headerRow.length, ...dataRows.map(r => r.length));

        const seenLabels = new Map();
        const cols = [];
        for (let idx = 0; idx < colCount; idx++) {
          const rawHeader = String(headerRow[idx] ?? '').trim();
          const baseLabel = rawHeader || `Column ${idx + 1}`;
          const count = (seenLabels.get(baseLabel) || 0) + 1;
          seenLabels.set(baseLabel, count);
          // Disambiguate duplicate header names for display only; matching still uses rawHeader.
          const displayLabel = count > 1 ? `${baseLabel} (${count})` : baseLabel;
          cols.push({ idx, header: rawHeader, displayLabel });
        }

        const mapping = {};
        cols.forEach(col => { mapping[col.idx] = findBestMatch(col.header); });

        setColumns(cols);
        setAllRows(dataRows);
        setHeaderMapping(mapping);
        setStep(2);
      } catch (err) {
        toast.error('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (colIdx, target) => {
    setHeaderMapping(prev => ({
      ...prev,
      [colIdx]: target
    }));
  };

  const handleProceedToPreview = () => {
    if (!Object.values(headerMapping).includes(requiredField.key)) {
      toast.error(`Please map "${requiredField.label}" column — it is required`);
      return;
    }
    setStep(3);
  };

  const convertExcelDate = (val) => {
    if (typeof val === 'number') {
      const d = new Date((val - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }
    return val;
  };

  const buildRow = (rawRowArray) => {
    const newRow = {};
    const custom = {};
    Object.entries(headerMapping).forEach(([colIdxStr, target]) => {
      if (!target) return;
      let val = rawRowArray[Number(colIdxStr)];
      if (val === undefined || val === '' || val === null) return;

      if (target.startsWith('custom:')) {
        const key = target.slice('custom:'.length);
        custom[key] = val;
      } else {
        if (dateFields.includes(target)) val = convertExcelDate(val);
        newRow[target] = val;
      }
    });
    if (Object.keys(custom).length > 0) newRow.customFields = custom;
    return newRow;
  };

  const handleImport = async () => {
    if (allRows.length === 0) return;

    try {
      const transformedRows = allRows
        .map(buildRow)
        .filter(row => row[requiredField.key]);

      if (transformedRows.length === 0) {
        toast.error(`No valid rows to import (all rows must have ${requiredField.label})`);
        return;
      }

      await onImport(transformedRows);
      resetState();
      onClose();
    } catch (err) {
      toast.error('Import error: ' + err.message);
    }
  };

  if (!isOpen) return null;

  const mappedTargets = Object.values(headerMapping).filter(Boolean);
  const unmatchedCount = columns.length - mappedTargets.length;
  const mappedColumns = columns.filter(col => headerMapping[col.idx]);
  const previewRows = allRows.slice(0, 10);

  return (
    <div className="bulk-import-overlay">
      <div className="bulk-import-modal">
        <div className="bim-header">
          <h3>{title}</h3>
          <button className="bim-close" onClick={onClose}>×</button>
        </div>

        {step === 1 && (
          <div className="bim-content">
            <div className="bim-section">
              <p className="bim-info">Upload an Excel (.xlsx, .xls) or CSV file with your data.</p>
              <div className="bim-file-input-wrapper">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="bim-file-input"
                  id="bulk-import-file"
                />
                <label htmlFor="bulk-import-file" className="bim-file-label">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>Click to select file or drag and drop</span>
                </label>
              </div>
              {selectedFile && (
                <p className="bim-file-name">Selected: <strong>{selectedFile.name}</strong></p>
              )}
            </div>

            <div className="bim-footer">
              <button className="bim-btn-cancel" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bim-content">
            <div className="bim-section">
              <p className="bim-info">
                Found <strong>{columns.length} column{columns.length !== 1 ? 's' : ''}</strong> and{' '}
                <strong>{allRows.length} row{allRows.length !== 1 ? 's' : ''}</strong> of data.
                Map every column to a field. We've auto-matched what we recognized
                {unmatchedCount > 0 ? ` — please review the ${unmatchedCount} unmatched column${unmatchedCount > 1 ? 's' : ''} below.` : '.'}
              </p>
              <div className="bim-mapping-grid">
                {columns.map(col => (
                  <div key={col.idx} className={`bim-mapping-row ${!headerMapping[col.idx] ? 'unmatched' : ''}`}>
                    <label className="bim-mapping-label">{col.displayLabel}</label>
                    <select
                      value={headerMapping[col.idx] || ''}
                      onChange={(e) => handleMappingChange(col.idx, e.target.value)}
                      className="bim-mapping-select"
                    >
                      <option value="">Skip this column</option>
                      {importTargets.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Note: "{requiredField.label}" field is required. Dates should be in YYYY-MM-DD format. Columns set to
                "Skip this column" will not be imported — if a field you need is missing, add it from Manage Fields first.
              </p>
            </div>

            <div className="bim-footer">
              <button className="bim-btn-cancel" onClick={() => setStep(1)}>Back</button>
              <button
                className="bim-btn-next"
                onClick={handleProceedToPreview}
              >
                Next: Preview
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bim-content">
            <div className="bim-section">
              <p className="bim-info">Preview of first 10 rows that will be imported (of {allRows.length} total):</p>
              <div className="bim-preview-table" style={{ overflow: 'auto', maxHeight: '300px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                      {mappedColumns.map(col => {
                        const target = headerMapping[col.idx];
                        const t = importTargets.find(it => it.value === target);
                        return (
                          <th key={col.idx} style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #e5e7eb' }}>
                            {t ? t.label : target}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIdx) => (
                      <tr key={rowIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {mappedColumns.map(col => (
                          <td key={col.idx} style={{ padding: '8px', borderRight: '1px solid #f3f4f6' }}>
                            {row[col.idx]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bim-footer">
              <button className="bim-btn-cancel" onClick={() => setStep(2)}>Back</button>
              <button
                className="bim-btn-import"
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? 'Importing...' : `Import Now (${allRows.length} rows)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
