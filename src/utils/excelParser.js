import * as XLSX from 'xlsx';

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array', defval: '' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        if (!worksheet) {
          reject(new Error('No worksheet found'));
          return;
        }

        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const rows = [];
        
        for (let row = range.s.r; row <= range.e.r; row++) {
          const rowData = {};
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellRef];
            const value = cell ? cell.v : '';
            rowData[col] = value || '';
          }
          rows.push(rowData);
        }

        const { headerRow, dataStartRow } = detectHeaderRow(rows);
        
        if (headerRow === -1) {
          reject(new Error('Could not detect header row'));
          return;
        }

        const headers = rows[headerRow];
        const headerNames = Object.values(headers)
          .filter(h => h && String(h).trim() !== '')
          .map(h => String(h).trim());

        if (headerNames.length === 0) {
          reject(new Error('No headers found'));
          return;
        }

        const dataRows = [];
        for (let i = dataStartRow; i < rows.length; i++) {
          const row = rows[i];
          const obj = {};
          const colNames = Object.keys(row).sort((a, b) => parseInt(a) - parseInt(b));
          
          let headerIndex = 0;
          colNames.forEach(colIdx => {
            if (headerIndex < headerNames.length) {
              const value = row[colIdx];
              if (value !== '' && value !== null && value !== undefined) {
                obj[headerNames[headerIndex]] = value;
              }
              headerIndex++;
            }
          });

          if (Object.keys(obj).length > 0) {
            dataRows.push(obj);
          }
        }

        if (dataRows.length === 0) {
          reject(new Error('No data rows found'));
          return;
        }

        resolve({
          headers: headerNames,
          rows: dataRows,
          totalRows: dataRows.length,
          rawHeaders: Object.values(headers)
        });
      } catch (err) {
        reject(new Error('Failed to parse file: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function detectHeaderRow(rows) {
  let bestRow = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    const values = Object.values(row).filter(v => v !== '' && v !== null && v !== undefined);
    
    if (values.length === 0) continue;

    let score = values.length;
    values.forEach(v => {
      const str = String(v).trim();
      if (str.match(/^[a-zA-Z]/i) || str.includes(' ')) {
        score += 2;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  if (bestRow === -1) bestRow = 0;

  return { headerRow: bestRow, dataStartRow: bestRow + 1 };
}

export function autoMapHeaders(excelHeaders) {
  const appFields = [
    'date', 'referredBy', 'name', 'level', 'course', 'providerName',
    'initialIntake', 'deferredIntake', 'gsSubmission',
    'olRequest', 'offerLetter', 'withdraw', 'coeCas', 'payment',
    'visaLodgement', 'visaOutcome', 'visaWithdraw', 'savisFee', 'refund',
    'remarks', 'other', 'through'
  ];

  const mapping = {};
  const unmapped = [];

  excelHeaders.forEach(header => {
    const lowerHeader = header.toLowerCase().trim();
    
    let match = appFields.find(f => f.toLowerCase() === lowerHeader);
    
    if (!match) {
      if (lowerHeader.includes('name') && lowerHeader.includes('applicant')) match = 'name';
      else if (lowerHeader.includes('date') && lowerHeader.includes('(ad)')) match = 'date';
      else if (lowerHeader.includes('referred')) match = 'referredBy';
      else if (lowerHeader.includes('intake') && lowerHeader.includes('initial')) match = 'initialIntake';
      else if (lowerHeader.includes('intake') && lowerHeader.includes('defer')) match = 'deferredIntake';
      else if (lowerHeader.includes('gs')) match = 'gsSubmission';
      else if (lowerHeader.includes('ol') && lowerHeader.includes('request')) match = 'olRequest';
      else if (lowerHeader.includes('offer') || lowerHeader.includes('i20')) match = 'offerLetter';
      else if (lowerHeader.includes('withdraw') && lowerHeader.includes('visa')) match = 'visaWithdraw';
      else if (lowerHeader.includes('withdraw')) match = 'withdraw';
      else if (lowerHeader.includes('coe') || lowerHeader.includes('cas')) match = 'coeCas';
      else if (lowerHeader.includes('level')) match = 'level';
      else if (lowerHeader.includes('course')) match = 'course';
      else if (lowerHeader.includes('provider')) match = 'providerName';
      else if (lowerHeader.includes('payment')) match = 'payment';
      else if (lowerHeader.includes('visa') && lowerHeader.includes('lodge')) match = 'visaLodgement';
      else if (lowerHeader.includes('visa') && lowerHeader.includes('date')) match = 'visaLodgement';
      else if (lowerHeader.includes('visa') && lowerHeader.includes('outcome')) match = 'visaOutcome';
      else if (lowerHeader.includes('savis') || lowerHeader.includes('sevis')) match = 'savisFee';
      else if (lowerHeader.includes('refund')) match = 'refund';
      else if (lowerHeader.includes('remark')) match = 'remarks';
      else if (lowerHeader.includes('through')) match = 'through';
      else if (lowerHeader.includes('other')) match = 'other';
    }

    if (match) {
      mapping[header] = match;
    } else {
      unmapped.push(header);
    }
  });

  return { mapping, unmapped };
}

export function transformRow(row, headerMapping) {
  const transformed = {};

  Object.entries(headerMapping).forEach(([excelHeader, appField]) => {
    if (!appField || !row.hasOwnProperty(excelHeader)) return;

    let value = row[excelHeader];
    if (value === '' || value === null || value === undefined) return;

    if (appField === 'date') {
      if (typeof value === 'number') {
        value = excelSerialToDate(value);
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        const parsed = parseDate(trimmed);
        value = parsed || trimmed;
      }
    } else if (appField === 'initialIntake' || appField === 'deferredIntake') {
      if (typeof value === 'number') {
        value = excelSerialToMonthYear(value);
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        const parsed = parseToMonthYear(trimmed);
        value = parsed || trimmed;
      }
    } else if (typeof value === 'string') {
      value = value.trim();
    }

    if (value !== '' && value !== null) {
      transformed[appField] = value;
    }
  });

  return transformed;
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  dateStr = dateStr.trim();
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const d = new Date(dateStr);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }
  const d = new Date(dateStr);
  if (!isNaN(d) && d.getFullYear() > 1900) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function excelSerialToMonthYear(excelSerial) {
  if (typeof excelSerial !== 'number') return null;
  const excelDate = new Date((excelSerial - 25569) * 86400 * 1000);
  if (isNaN(excelDate.getTime())) return null;
  const month = MONTH_NAMES[excelDate.getUTCMonth()];
  const year = excelDate.getUTCFullYear();
  return `${month} ${year}`;
}

function parseToMonthYear(str) {
  if (!str) return null;
  const monthYearMatch = str.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const [, monthPart, year] = monthYearMatch;
    const idx = MONTH_NAMES.findIndex(m => monthPart.toLowerCase().startsWith(m.toLowerCase()));
    if (idx !== -1) return `${MONTH_NAMES[idx]} ${year}`;
    return null;
  }
  const d = new Date(str);
  if (!isNaN(d) && d.getFullYear() > 1900) {
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }
  return null;
}

function excelSerialToDate(excelSerial) {
  if (typeof excelSerial !== 'number') return null;
  const excelDate = new Date((excelSerial - 25569) * 86400 * 1000);
  if (isNaN(excelDate.getTime())) return null;
  return excelDate.toISOString().split('T')[0];
}
