
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function nameSimilarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.82;

export function findPossibleDuplicates(newRow, existingRows, { nameKey = 'name', excludeId = null } = {}) {
  const newName = newRow?.[nameKey];
  if (!newName || !String(newName).trim()) return [];
  return existingRows
    .filter(r => r && r._id !== excludeId)
    .map(r => ({ row: r, score: nameSimilarity(r[nameKey], newName) }))
    .filter(({ score }) => score >= DUPLICATE_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

export function diffFields(existing, incoming, fields) {
  return fields.map(({ key, label }) => {
    const existingValue = existing?.[key] ?? '';
    const newValue = incoming?.[key] ?? '';
    return {
      key, label, existingValue, newValue,
      differs: String(existingValue).trim() !== String(newValue).trim(),
    };
  });
}

export const APPLICATION_COMPARE_FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'level', label: 'Level' },
  { key: 'course', label: 'Course' },
  { key: 'providerName', label: 'Provider' },
  { key: 'offerLetter', label: 'OL Received' },
  { key: 'payment', label: 'Payment' },
];

export const INQUIRY_COMPARE_FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'country', label: 'Country' },
  { key: 'level', label: 'Level' },
  { key: 'stage', label: 'Stage' },
  { key: 'mode', label: 'Mode / Channel' },
];
