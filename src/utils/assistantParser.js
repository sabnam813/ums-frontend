
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_ABBR = { jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };
const numOf = w => (/^\d+$/.test(w) ? Number(w) : NUM_WORDS[w] || null);

function parseDateToken(str) {
  const t = String(str).trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?,?\s*(\d{4})?$/i) || null;
  if (m) {
    const mi = monthIndex(m[2]);
    if (mi >= 0) return `${m[3] || new Date().getFullYear()}-${String(mi + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  m = t.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?$/i);
  if (m) {
    const mi = monthIndex(m[1]);
    if (mi >= 0) return `${m[3] || new Date().getFullYear()}-${String(mi + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  }
  return null;
}
function monthIndex(w) {
  const l = String(w).toLowerCase();
  const full = MONTHS.indexOf(l);
  if (full >= 0) return full;
  return MONTH_ABBR[l] !== undefined ? MONTH_ABBR[l] : -1;
}

const DATE_TOKEN = '(\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+[a-z]{3,9}\\.?(?:,?\\s*\\d{4})?|[a-z]{3,9}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?)';

export function extractRange(text) {
  let t = ` ${text} `;
  const take = (re, build) => {
    const m = t.match(re);
    if (!m) return null;
    t = t.replace(re, ' ');
    return build(m);
  };

  let r = take(new RegExp(`\\b(?:from|between|since)\\s+${DATE_TOKEN}\\s+(?:to|and|until|till|-)\\s+${DATE_TOKEN}`, 'i'), m => {
    const a = parseDateToken(m[1]); const b = parseDateToken(m[2]);
    return a && b ? { range: 'custom', from: a, to: b } : null;
  });
  if (!r) r = take(new RegExp(`\\b(?:from|since|after)\\s+${DATE_TOKEN}\\b`, 'i'), m => { const a = parseDateToken(m[1]); return a ? { range: 'custom', from: a, to: '' } : null; });
  if (!r) r = take(new RegExp(`\\b(?:until|till|before|up to)\\s+${DATE_TOKEN}\\b`, 'i'), m => { const b = parseDateToken(m[1]); return b ? { range: 'custom', from: '', to: b } : null; });
  if (!r) r = take(new RegExp(`\\b(?:on|dated?|of)\\s+${DATE_TOKEN}\\b`, 'i'), m => { const a = parseDateToken(m[1]); return a ? { range: 'custom', from: a, to: a } : null; });
  if (!r) r = take(/\b(?:in\s+)?the\s+(?:last|past)\s+(\w+)\s+(days?|weeks?|months?)\b|\b(?:last|past)\s+(\w+)\s+(days?|weeks?|months?)\b/i, m => {
    const n = numOf((m[1] || m[3] || '').toLowerCase()); const unit = (m[2] || m[4]).toLowerCase().replace(/s$/, '');
    return n ? { range: `last:${n}:${unit}s` } : null;
  });
  if (!r) r = take(/\b(?:in\s+)?(?:the\s+)?next\s+(\w+)\s+(days?|weeks?|months?)\b/i, m => {
    const n = numOf(m[1].toLowerCase()); const unit = m[2].toLowerCase().replace(/s$/, '');
    return n ? { range: `next:${n}:${unit}s` } : null;
  });
  if (!r) r = take(/\b(?:since\s+)?last\s+(?:7|seven)\s+days\b|\bpast\s+week\b/i, () => ({ range: 'last:7:days' }));
  if (!r) r = take(/\b(?:past|last)\s+month\s+ago\b/i, () => ({ range: 'lastMonth' }));
  const SIMPLE = [
    [/\btoday(?:'s)?\b/i, 'today'], [/\byesterday\b/i, 'yesterday'], [/\btomorrow\b/i, 'tomorrow'],
    [/\bthis\s+week\b/i, 'thisWeek'], [/\blast\s+week\b/i, 'lastWeek'], [/\bnext\s+week\b/i, 'nextWeek'],
    [/\bthis\s+month\b|\bcurrent\s+month\b|\bmonth\s+to\s+date\b/i, 'thisMonth'], [/\blast\s+month\b|\bprevious\s+month\b/i, 'lastMonth'], [/\bnext\s+month\b/i, 'nextMonth'],
    [/\bthis\s+quarter\b/i, 'thisQuarter'], [/\blast\s+quarter\b/i, 'lastQuarter'],
    [/\bthis\s+year\b|\bcurrent\s+year\b/i, 'thisYear'], [/\blast\s+year\b|\bprevious\s+year\b/i, 'lastYear'],
    [/\ball\s*time\b|\boverall\b|\bever\b|\bin\s+total\b/i, 'allTime'],
  ];
  if (!r) r = take(/\b(?:in|during|for|of|year)\s+(20\d{2})\b(?!\s*intake)/i, m => ({ range: `year:${m[1]}` }));
  if (!r) for (const [re, key] of SIMPLE) { const hit = take(re, () => ({ range: key })); if (hit) { r = hit; break; } }
  return { ...(r || {}), remaining: t.replace(/\s+/g, ' ').trim(), explicit: !!r };
}

function extractMonth(text) {
  const re = new RegExp(`\\b(?:in\\s+|for\\s+|during\\s+|of\\s+)?(${MONTHS.join('|')}|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\\.?(?:\\s+(\\d{4}))?\\b`, 'i');
  const m = text.match(re);
  if (!m) return null;
  const w = m[1].toLowerCase();
  if (w === 'may' && !/\b(in|for|during|of)\s+may\b|\bmay\s+\d{4}\b/i.test(text)) return null;
  if (['mar', 'sep', 'sept', 'oct', 'dec', 'jan', 'feb', 'apr', 'jun', 'jul', 'aug', 'nov'].includes(w) && !m[2] && !/\b(in|for|during|of)\s+/i.test(m[0])) return null;
  const mi = monthIndex(w);
  if (mi < 0) return null;
  const year = m[2] ? Number(m[2]) : null;
  return { range: `${MONTHS[mi]}${year ? '-' + year : ''}`, matched: m[0] };
}

function allPhrases(entities) {
  const out = [];
  entities.forEach(e => {
    const names = new Set([e.label.toLowerCase(), e.singular, ...(e.aliases || [])]);
    names.forEach(n => { if (n) out.push({ entity: e, phrase: n.toLowerCase() }); });
  });
  return out.sort((a, b) => b.phrase.length - a.phrase.length);
}

function phraseRegex(p) {
  const parts = p.split(/[\s-]+/).map(esc).join('[\\s-]*');
  return new RegExp(`(?:^|[^a-z0-9])${parts}(?:s|es)?(?=$|[^a-z0-9])`, 'i');
}

function detectEntity(text, catalog, preferKeys) {
  const phrases = allPhrases(catalog.entities);
  const lower = ` ${text.toLowerCase()} `;
  const hits = [];
  for (const { entity, phrase } of phrases) {
    const m = lower.match(phraseRegex(phrase));
    if (m) hits.push({ entity, phrase, len: phrase.length, at: m.index });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.len - a.len || a.at - b.at);
  if (preferKeys) { const p = hits.find(h => preferKeys.includes(h.entity.key)); if (p) return p; }
  return hits[0];
}

function matchValues(text, entity) {
  const found = [];
  const lower = ` ${norm(text)} `;
  Object.entries(entity.vocab || {}).forEach(([field, values]) => {
    let best = null;
    values.forEach(v => {
      const n = norm(v);
      if (!n || n.length < 2) return;
      if (lower.includes(` ${n} `) && (!best || n.length > norm(best).length)) best = v;
    });
    if (best) found.push({ field, value: best, len: norm(best).length });
  });
  return found.sort((a, b) => b.len - a.len);
}

function matchCountry(text, catalog) {
  const lower = ` ${norm(text)} `;
  let best = null;
  (catalog.countries || []).forEach(c => {
    const n = norm(c.name);
    if (n && n.length >= 2 && lower.includes(` ${n} `) && (!best || n.length > best.len)) best = { name: c.name, len: n.length, token: n };
    const code = (c.code || '').trim();
    if (code.length >= 2 && new RegExp(`(?:^|[^A-Za-z])${esc(code.toUpperCase())}(?=$|[^A-Za-z])`).test(text) && (!best || code.length > best.len)) {
      best = { name: c.name, len: code.length, token: code.toLowerCase() };
    }
  });
  const aliases = { UK: 'united kingdom', USA: 'united states', US: 'united states', UAE: 'united arab emirates', NZ: 'new zealand' };
  Object.entries(aliases).forEach(([k, full]) => {
    if (new RegExp(`(?:^|[^A-Za-z])${k}(?=$|[^A-Za-z])`).test(text)) {
      const c = (catalog.countries || []).find(x => norm(x.name) === full || norm(x.name).startsWith(full.slice(0, 6)));
      if (c && (!best || k.length >= best.len)) best = { name: c.name, len: k.length, token: k.toLowerCase() };
    }
  });
  return best;
}

function matchPresets(text, entity) {
  const hits = [];
  (entity.presets || []).forEach(p => {
    (p.phrases || []).forEach(src => {
      try {
        const re = new RegExp(`(?:^|[^a-z0-9])(?:${src})(?=$|[^a-z0-9])`, 'i');
        const m = text.match(re);
        if (m) hits.push({ preset: p, len: m[0].length });
      } catch { }
    });
  });
  const seen = new Set();
  return hits.sort((a, b) => b.len - a.len).filter(h => (seen.has(h.preset.key) ? false : seen.add(h.preset.key))).map(h => h.preset);
}

function detectGroupField(text, entity) {
  const lower = ` ${text.toLowerCase()} `;
  let best = null;
  Object.entries(entity.fieldWords || {}).forEach(([field, words]) => {
    (words || []).forEach(w => {
      if (new RegExp(`(?:^|[^a-z])${esc(w)}(?=$|[^a-z])`, 'i').test(lower)) {
        if (!(entity.groupable || []).includes(field)) return;
        if (!best || w.length > best.len) best = { field, len: w.length, word: w };
      }
    });
  });
  return best;
}

const GREET = /^(hi|hello|hey|namaste|hola|good (morning|afternoon|evening))\b[\s!.?]*$/i;
const THANKS = /^(thanks?|thank you|ty|ok(ay)?|cool|great|nice)\b[\s!.?]*$/i;
const TEACH = /\b(teach|train|tutorial|show me how|how (?:do|can|should|would) (?:i|we)|how to|guide me|walk me through|help me (?:with|to)|explain how|steps? (?:to|for))\b/i;
const WHERE_PAGE = /\b(where (?:is|are|can i|do i find|to find|do i see|to see)|take me to|go to|open|navigate to|bring me to|show me the page|which page|how do i get to|link to)\b/i;
const COUNT = /\b(how many|how much|count|total|number of|no\.? of|tally|sum of)\b/i;
const TOP = /\b(which|who|what)\b[^?]*\b(most|highest|top|largest|biggest|maximum|least|lowest|fewest|minimum)\b|\b(top|highest|most|best|least|lowest)\s+\d*\s*\w+/i;
const DUP = /\b(duplicates?|duplicated|same name|repeated|twice|double entr(?:y|ies))\b/i;
const LIST = /\b(list|show|display|give me|get me|find|search|look ?up|locate|fetch|pull up|who (?:is|are)|what (?:is|are)|which)\b/i;
const FIND_PERSON = /\b(where(?:'s| is)|find|search(?: for)?|locate|look ?up|who is|show me|details? (?:of|for|about)|info(?:rmation)? (?:of|on|about)|contact (?:of|for)|phone (?:of|for)|email (?:of|for))\b/i;

function stripLead(text) {
  return text
    .replace(/^(please|pls|can you|could you|would you|kindly|tell me|let me know|i want to know|i need to know|i would like to know|i'd like to know)\s+/i, '')
    .replace(/[?.!]+$/, '').trim();
}

function mentionedFeatures(text, catalog) {
  const lower = ` ${text.toLowerCase()} `;
  const hits = [];
  (catalog.features || []).forEach(f => {
    const names = [f.label.toLowerCase(), ...(f.aliases || [])];
    names.forEach(n => { const m = lower.match(phraseRegex(n)); if (m) hits.push({ feature: f, len: n.length }); });
  });
  const seen = new Set();
  return hits.sort((a, b) => b.len - a.len).filter(h => (seen.has(h.feature.key) ? false : seen.add(h.feature.key))).map(h => h.feature);
}

function restrictedMention(text, catalog) {
  const lower = ` ${text.toLowerCase()} `;
  let best = null;
  (catalog.restricted || []).forEach(r => {
    [r.label.toLowerCase(), ...(r.aliases || [])].forEach(n => {
      if (!n || n.length < 4) return;
      if (phraseRegex(n).test(lower) && (!best || n.length > best.len)) best = { label: r.label, len: n.length };
    });
  });
  return best;
}

export function parseAssistantInput(raw, catalog) {
  const original = String(raw || '').trim();
  if (!original) return { intent: 'unknown' };
  if (!catalog) return { intent: 'loading' };
  const text = stripLead(original);

  if (GREET.test(text)) return { intent: 'greet' };
  if (THANKS.test(text)) return { intent: 'thanks' };
  if (/^(help|\?|what can you do|commands|how do i (ask|use you)|how to (ask|use))\b/i.test(text)) return { intent: 'help' };

  if (TEACH.test(text) || /^teach\b/i.test(text)) {
    const rest = text.replace(TEACH, ' ').trim();
    if (/\b(all|everything|every process|whole (?:system|app|crm)|each|full tour|complete tour)\b/i.test(rest)) {
      return { intent: 'teach', all: true };
    }
    const feats = mentionedFeatures(rest || text, catalog);
    if (feats.length) return { intent: 'teach', feature: feats[0].key, topic: rest };
    const r = restrictedMention(rest || text, catalog);
    if (r) return { intent: 'denied', what: r.label };
    return { intent: 'teach', topic: rest };
  }

  const pageHit = WHERE_PAGE.test(text) || /^(open|go to|take me to)\b/i.test(text);
  if (pageHit) {
    const rest = text.replace(WHERE_PAGE, ' ').trim();
    const feats = mentionedFeatures(rest || text, catalog);
    const dataQ = COUNT.test(text) || /\b(see|check|view|know|find out)\b.*\b(how many|count|total|visa|granted|number)\b/i.test(text);
    if (feats.length && !dataQ) {
      return { intent: 'goto', feature: feats[0].key };
    }
    if (dataQ) {
      const inner = parseAssistantInput(text.replace(WHERE_PAGE, ' ').replace(/\b(see|check|view|know|find out)\b/gi, ' '), catalog);
      if (inner.intent === 'query') return { ...inner, whereHint: true };
    }
    if (!feats.length) {
      const r = restrictedMention(rest || text, catalog);
      if (r && !/\b(is|are)\s+[A-Z][a-z]+\s+[A-Z]/.test(original)) return { intent: 'denied', what: r.label };
    }
  }

  const isCount = COUNT.test(text);
  const isTop = TOP.test(text);
  const isDup = DUP.test(text);

  const ent = detectEntity(text, catalog, null);
  let entity = ent ? ent.entity : null;

  if (!entity) {
    for (const e of catalog.entities) {
      if (matchPresets(text, e).length) { entity = e; break; }
    }
  }
  if (!entity && (isCount || isTop || LIST.test(text))) {
    const rr = restrictedMention(text, catalog);
    if (rr) return { intent: 'denied', what: rr.label };
  }
  if (!entity && isCount) entity = catalog.entities.find(e => e.key === 'applications') || null;

  if (entity && (isCount || isTop || isDup || LIST.test(text) || ent)) {
    let work = text;
    if (ent) work = work.replace(phraseRegex(ent.phrase), ' ');

    const rangeInfo = extractRange(work);
    work = rangeInfo.remaining;

    const values = matchValues(work, entity);
    let monthRange = null;
    const intakeFound = values.find(v => /intake/i.test(v.field));
    if (!rangeInfo.explicit && !intakeFound && !/\b(?:[a-z]+\.?\s*\d{0,4})\s+intake\b/i.test(work)) {
      const mo = extractMonth(work);
      if (mo) { monthRange = mo; work = work.replace(mo.matched, ' '); }
    }
    const intakeText = !intakeFound && /\bintake\b/i.test(work)
      ? (work.match(/((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?(?:\s*\d{4})?|\d{4})\s+intake|intake\s+((?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s*\d{4})?)/i) || null)
      : null;

    const ctry = entity.countryBased ? matchCountry(work, catalog) : null;
    const presets = matchPresets(work, entity);

    const filters = [];
    const usedFields = new Set();
    values.forEach(v => {
      if (usedFields.has(v.field)) return;
      if (presets.some(p => p.filter && p.filter.field === v.field && p.filter.op === 'eq')) return;
      usedFields.add(v.field);
      filters.push({ field: v.field, op: 'eq', value: v.value });
    });
    if (intakeText && entity.fields.some(f => f.key === 'initialIntake')) {
      filters.push({ field: 'initialIntake', op: 'contains', value: (intakeText[1] || intakeText[2]).trim() });
    }

    let free = work;
    values.forEach(v => { free = free.replace(new RegExp(esc(v.value), 'ig'), ' '); });
    if (ctry) free = free.replace(new RegExp(`\\b${esc(ctry.token)}\\b`, 'ig'), ' ');
    presets.forEach(p => (p.phrases || []).forEach(src => { try { free = free.replace(new RegExp(`(?:^|[^a-z0-9])(?:${src})(?=$|[^a-z0-9])`, 'ig'), ' '); } catch { } }));

    const op = isDup ? 'duplicates' : isTop ? 'top' : isCount ? 'count' : 'list';
    const q = {
      intent: 'query', op, entity: entity.key,
      range: (rangeInfo.range || (monthRange && monthRange.range)) || 'allTime',
      from: rangeInfo.from || undefined, to: rangeInfo.to || undefined,
      country: ctry ? ctry.name : undefined,
      presets: presets.map(p => p.key),
      filters,
    };
    (entity.dateFields || []).forEach(d => {
      if (new RegExp(`\\b${esc(d.label)}s?\\b`, 'i').test(text)) q.dateField = d.key;
    });

    if (op === 'top') {
      const asc = /\b(least|lowest|fewest|minimum|bottom)\b/i.test(text);
      const g = detectGroupField(text.replace(phraseRegex(ent ? ent.phrase : '___'), ' '), entity)
        || detectGroupField(text, entity);
      if (g) q.groupBy = g.field;
      else q.groupBy = (entity.groupable || [])[0];
      q.order = asc ? 'asc' : 'desc';
      const n = text.match(/\btop\s+(\d{1,2})\b/i);
      if (n) q.limit = Number(n[1]);
    }

    const lead = free.match(/\b(?:named|called|for|under|by|with|about|of|from|referred by|through)\s+([a-z0-9][a-z0-9 .'&@-]{1,60}?)\s*$/i);
    if (lead && op !== 'top' && op !== 'duplicates') {
      const cand = lead[1].replace(/\b(the|a|an|in|on|at|and|please|records?|data|entries|list|students?|for|from|by|with|under|to|of|is|are|what|how|many|much|number|total|count|show|me|all|visa|visas)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const stop = /^(all|any|every|each|total|me|us|it|them|this|that|there|here|now)$/i;
      if (cand.length >= 2 && !stop.test(cand) && !monthIndexPhrase(cand)) q.text = cand;
    }
    return q;
  }

  if (FIND_PERSON.test(text) || (LIST.test(text) && !entity)) {
    const target = text.replace(FIND_PERSON, ' ').replace(/\b(please|the|applicant|student|record|details?|of|for|about|information|info)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (target.length >= 2) {
      const r = restrictedMention(target, catalog);
      if (r && target.split(' ').length <= 3 && norm(target) === norm(r.label)) return { intent: 'denied', what: r.label };
      return { intent: 'find', text: target };
    }
  }

  if (text.split(/\s+/).length <= 5 && /[a-z]/i.test(text) && !/\?$/.test(original)) {
    const feats = mentionedFeatures(text, catalog);
    if (feats.length && norm(text) === norm(feats[0].feature ? feats[0].feature.label : feats[0].label)) return { intent: 'goto', feature: feats[0].key };
    const r = restrictedMention(text, catalog);
    if (r && norm(text) === norm(r.label)) return { intent: 'denied', what: r.label };
    return { intent: 'find', text };
  }

  const r = restrictedMention(text, catalog);
  if (r) return { intent: 'denied', what: r.label };
  return { intent: 'unknown' };
}

function monthIndexPhrase(s) {
  const l = String(s).toLowerCase().trim();
  return MONTHS.includes(l) || /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/.test(l);
}

export const CAPABILITIES = [
  'Count: applications, visas, follow-ups, bookings.',
  'List: who or what matches.',
  'Rank: top or lowest by country, course, associate.',
  'Find: any record, with a link to it.',
  'Open: any page you can access.',
  'Teach: any process, step by step.',
];
