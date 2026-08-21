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

const YES_NO_SYNONYMS = {
  yes: ['y', 'true', '1', 'yep', 'yeah'],
  no: ['n', 'false', '0', 'nope'],
};

function matchOptionValue(fieldKey, rawValue, optionsByField) {
  const options = optionsByField?.[fieldKey];
  if (!options || options.length === 0) return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  if (rawValue === undefined || rawValue === null || rawValue === '') return rawValue;

  const raw = String(rawValue).trim();
  const n = normalize(raw);
  if (!n) return raw;

  let match = options.find(o => normalize(o) === n);
  if (match) return match;

  for (const opt of options) {
    const optNorm = normalize(opt);
    const synonymList = YES_NO_SYNONYMS[optNorm];
    if (synonymList && synonymList.includes(n)) return opt;
  }

  return raw;
}

function sampleNonEmpty(values, max = 25) {
  const out = [];
  for (const v of values) {
    if (v === '' || v === null || v === undefined) continue;
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function looksLikeDateValue(v) {
  if (typeof v === 'number') return v > 20000 && v < 60000;
  const s = String(v).trim();
  if (!s) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return true;
  if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(s)) return true;
  if (/^\d{1,2}\s+[A-Za-z]{3,9}[a-z]*\s+\d{2,4}$/.test(s)) return true;
  if (/^[A-Za-z]{3,9}[a-z]*\s+\d{1,2},?\s+\d{2,4}$/.test(s)) return true;
  return false;
}

function looksLikeNameValue(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s || s.length > 50 || /\d/.test(s)) return false;
  const words = s.split(/\s+/);
  return words.length >= 1 && words.length <= 5 && /^[A-Za-z.'\-\s]+$/.test(s);
}

function looksLikeNumberValue(v) {
  if (typeof v === 'number') return true;
  const s = String(v).trim().replace(/,/g, '');
  return s !== '' && !isNaN(Number(s));
}

const AMOUNT_KEYWORDS = ['amount', 'fee', 'margin', 'paid', 'price', 'cost'];

function guessTargetFromValues(values, importTargets, optionsByField, assigned, requiredField, dateFields) {
  const sample = sampleNonEmpty(values);
  if (sample.length < 2) return '';

  const dateRatio = sample.filter(looksLikeDateValue).length / sample.length;
  if (dateRatio >= 0.75) {
    const candidate = (dateFields || []).find(key => !assigned.has(key) && importTargets.some(t => t.value === key));
    if (candidate) return candidate;
  }

  let bestField = '';
  let bestRatio = 0;
  Object.entries(optionsByField || {}).forEach(([fieldKey, options]) => {
    if (assigned.has(fieldKey) || !options || options.length === 0) return;
    if (!importTargets.some(t => t.value === fieldKey)) return;
    const matchCount = sample.filter(v => {
      const matched = matchOptionValue(fieldKey, v, optionsByField);
      return options.some(o => normalize(o) === normalize(matched));
    }).length;
    const ratio = matchCount / sample.length;
    if (ratio > bestRatio) { bestRatio = ratio; bestField = fieldKey; }
  });
  if (bestField && bestRatio >= 0.75) return bestField;

  if (requiredField && !assigned.has(requiredField.key)) {
    const nameRatio = sample.filter(looksLikeNameValue).length / sample.length;
    if (nameRatio >= 0.8) return requiredField.key;
  }

  const numberRatio = sample.filter(looksLikeNumberValue).length / sample.length;
  if (numberRatio >= 0.9) {
    const amountCandidates = importTargets.filter(t =>
      !assigned.has(t.value) && AMOUNT_KEYWORDS.some(kw => normalize(t.label).includes(kw))
    );
    if (amountCandidates.length === 1) return amountCandidates[0].value;
  }

  return '';
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
  { key: 'gsSubmission', label: 'GS/WIP/Financial', aliases: ['gs', 'gssubmission', 'genuinestudent'] },
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
  optionsByField = {},
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [columns, setColumns] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [headerMapping, setHeaderMapping] = useState({});
  const [patternDetectedCols, setPatternDetectedCols] = useState(new Set());
  const [step, setStep] = useState(1);
  const [importSummary, setImportSummary] = useState(null);
  const [pendingWorkbook, setPendingWorkbook] = useState(null);

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
    const candidates = importTargets.filter(t => {
      const labelNorm = normalize(t.label);
      return labelNorm && (labelNorm.includes(n) || n.includes(labelNorm));
    });
    if (candidates.length) {
      candidates.sort((a, b) => normalize(b.label).length - normalize(a.label).length);
      return candidates[0].value;
    }
    return '';
  };

  const resetState = () => {
    setSelectedFile(null);
    setPasteText('');
    setColumns([]);
    setAllRows([]);
    setHeaderMapping({});
    setPatternDetectedCols(new Set());
    setStep(1);
    setImportSummary(null);
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

  const processGrid = (grid) => {
    if (!grid || grid.length === 0) {
      toast.error('No data found');
      return;
    }

    const rawHeaderRow = grid[0] || [];
    const headerCells = rawHeaderRow.filter(c => c !== '' && c !== undefined && c !== null);
    const headerLooksLikeData = headerCells.length > 0 &&
      (headerCells.filter(c => looksLikeDateValue(c) || looksLikeNumberValue(c)).length / headerCells.length) >= 0.4;

    const headerRow = headerLooksLikeData ? [] : rawHeaderRow;
    const bodyRows = headerLooksLikeData ? grid : grid.slice(1);
    const dataRows = bodyRows.filter(r => r.some(c => c !== '' && c !== undefined && c !== null));

    if (dataRows.length === 0) {
      toast.error('No data rows found');
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
      const displayLabel = count > 1 ? `${baseLabel} (${count})` : baseLabel;
      cols.push({ idx, header: rawHeader, displayLabel });
    }

    const mapping = {};
    cols.forEach(col => { mapping[col.idx] = findBestMatch(col.header); });

    const assigned = new Set(Object.values(mapping).filter(Boolean));
    const detected = new Set();
    cols.forEach(col => {
      if (mapping[col.idx]) return;
      const values = dataRows.map(r => r[col.idx]);
      const guess = guessTargetFromValues(values, importTargets, optionsByField, assigned, requiredField, dateFields);
      if (guess) {
        mapping[col.idx] = guess;
        assigned.add(guess);
        detected.add(col.idx);
      }
    });

    setColumns(cols);
    setAllRows(dataRows);
    setHeaderMapping(mapping);
    setPatternDetectedCols(detected);
    if (detected.size > 0) {
      toast.success(`Auto-detected ${detected.size} column${detected.size > 1 ? 's' : ''} from data patterns`);
    }
    setStep(2);
  };

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        if (workbook.SheetNames.length > 1) {
          setPendingWorkbook(workbook);
        } else {
          loadSheet(workbook, workbook.SheetNames[0]);
        }
      } catch (err) {
        toast.error('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheet = (workbook, sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
    setPendingWorkbook(null);
    processGrid(grid);
  };

  const parsePastedText = (text) => {
    try {
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
      if (lines.length === 0) {
        toast.error('Nothing to import');
        return;
      }
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const grid = lines.map(line => line.split(delimiter).map(c => c.trim()));
      processGrid(grid);
    } catch (err) {
      toast.error('Failed to parse pasted data: ' + err.message);
    }
  };

  const handleMappingChange = (colIdx, target) => {
    setHeaderMapping(prev => ({
      ...prev,
      [colIdx]: target
    }));

    setPatternDetectedCols(prev => {
      if (!prev.has(colIdx)) return prev;
      const next = new Set(prev);
      next.delete(colIdx);
      return next;
    });
  };

  const handleProceedToPreview = () => {
    if (!Object.values(headerMapping).includes(requiredField.key)) {
      toast.error(`Please map the "${requiredField.label}" column. It is required.`);
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
        const fieldDef = customFields.find(cf => cf.key === key);
        if (fieldDef?.type === 'date') val = convertExcelDate(val);
        custom[key] = val;
      } else {
        if (dateFields.includes(target)) val = convertExcelDate(val);
        else val = matchOptionValue(target, val, optionsByField);
        newRow[target] = val;
      }
    });
    if (Object.keys(custom).length > 0) newRow.customFields = custom;
    return newRow;
  };

  const handleImport = async () => {
    if (allRows.length === 0) return;

    try {
      const transformedRows = allRows.map(buildRow);

      const summary = await onImport(transformedRows);
      setImportSummary(summary || { total: transformedRows.length, created: transformedRows.length, failed: 0, failures: [] });
      setStep(4);
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
            {pendingWorkbook ? (
              <div className="bim-section">
                <p className="bim-info">This file has {pendingWorkbook.SheetNames.length} sheets. Pick one to import.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingWorkbook.SheetNames.map(name => (
                    <button
                      key={name}
                      className="bim-btn-cancel"
                      style={{ textAlign: 'left' }}
                      onClick={() => loadSheet(pendingWorkbook, name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="bim-footer">
                  <button className="bim-btn-cancel" onClick={() => { setPendingWorkbook(null); setSelectedFile(null); }}>Cancel</button>
                </div>
              </div>
            ) : (
            <div className="bim-section">
              <p className="bim-info">Upload an Excel (.xlsx, .xls) or CSV file. If it has multiple sheets, you'll be asked which one to use.</p>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>OR PASTE DATA</span>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              </div>

              <p className="bim-info">
                Copy cells from Excel or Sheets, then paste them below. No file needed.
              </p>
              <textarea
                className="bim-paste-textarea"
                rows={6}
                placeholder="Paste copied spreadsheet cells here…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, resize: 'vertical' }}
              />
              <div style={{ marginTop: 10 }}>
                <button
                  className="bim-btn-next"
                  disabled={!pasteText.trim()}
                  onClick={() => parsePastedText(pasteText)}
                >
                  Parse Pasted Data
                </button>
              </div>
            </div>
            )}

            {!pendingWorkbook && (
            <div className="bim-footer">
              <button className="bim-btn-cancel" onClick={onClose}>Cancel</button>
            </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="bim-content">
            <div className="bim-section">
              <p className="bim-info">
                Found <strong>{columns.length} column{columns.length !== 1 ? 's' : ''}</strong> and{' '}
                <strong>{allRows.length} row{allRows.length !== 1 ? 's' : ''}</strong> of data.
                Map every column to a field. We've auto-matched what we recognized
                {unmatchedCount > 0 ? ` Please review the ${unmatchedCount} unmatched column${unmatchedCount > 1 ? 's' : ''} below.` : '.'}
              </p>
              {patternDetectedCols.size > 0 && (
                <p className="bim-info" style={{ background: '#eff6ff', color: '#1d4ed8', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}>
                  ✓ {patternDetectedCols.size} column{patternDetectedCols.size > 1 ? 's' : ''} below {patternDetectedCols.size > 1 ? 'were' : 'was'} auto-mapped and marked <strong>Auto-detected</strong>. Please double-check these.
                </p>
              )}
              <div className="bim-mapping-grid">
                {columns.map(col => (
                  <div key={col.idx} className={`bim-mapping-row ${!headerMapping[col.idx] ? 'unmatched' : ''}`}>
                    <label className="bim-mapping-label">
                      {col.displayLabel}
                      {patternDetectedCols.has(col.idx) && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '1px 6px', borderRadius: 10 }}>
                          Auto-detected
                        </span>
                      )}
                    </label>
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
                "Skip this column" will not be imported. If a field you need is missing, add it from Manage Fields first.
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

        {step === 4 && importSummary && (
          <div className="bim-content">
            <div className="bim-section">
              <p className="bim-info">
                <strong>Import Summary.</strong> Total rows: <strong>{importSummary.total}</strong>
                {' · '}Successfully imported: <strong>{importSummary.created}</strong>
                {' · '}Failed: <strong>{importSummary.failed}</strong>
              </p>

              {importSummary.failed > 0 && (
                <>
                  <p className="bim-info" style={{ color: '#b91c1c' }}>
                    The rows below were skipped and were NOT imported. Fix them in your file and re-import just those rows if needed.
                  </p>
                  <div className="bim-preview-table" style={{ overflow: 'auto', maxHeight: '260px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ position: 'sticky', top: 0, background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #e5e7eb' }}>Row</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #e5e7eb' }}>Name</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importSummary.failures.map((f, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px', borderRight: '1px solid #f3f4f6' }}>{f.row}</td>
                            <td style={{ padding: '8px', borderRight: '1px solid #f3f4f6' }}>{f.name || '-'}</td>
                            <td style={{ padding: '8px', color: '#b91c1c' }}>{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importSummary.failed === 0 && (
                <p className="bim-info" style={{ color: '#15803d' }}>
                  All rows imported successfully.
                </p>
              )}
            </div>

            <div className="bim-footer">
              <button
                className="bim-btn-import"
                onClick={() => { resetState(); onClose(); }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
