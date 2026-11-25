
export function loadRememberedColumns(storageKey, validKeys) {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const validSet = new Set(validKeys);
    const filtered = parsed.filter(k => validSet.has(k));
    return filtered.length ? filtered : null;
  } catch {
    return null;
  }
}

export function saveRememberedColumns(storageKey, keys) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(keys));
  } catch {
  }
}
