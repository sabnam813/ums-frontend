import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FiX, FiHelpCircle, FiSend, FiMousePointer, FiPlusCircle, FiFileText, FiSearch, FiUpload, FiDownload,
  FiPrinter, FiEdit2, FiClock, FiFolder, FiUsers, FiTrash2, FiShield, FiBarChart2, FiGlobe, FiColumns,
  FiLink, FiSidebar, FiNavigation, FiLock, FiMove, FiArrowRight, FiCheckCircle,
} from 'react-icons/fi';
import AssistantMascot from './AssistantMascot';
import { parseAssistantInput, CAPABILITIES } from '../../utils/assistantParser';
import { stepsForFeature, sidebarSelector, pickFeatureForTopic } from '../../utils/assistantGuides';
import './AiAssistantWidget.css';

const POS_KEY = 'ums_assistant_pos';
const OPENED_KEY = 'ums_assistant_opened_once';
const MARGIN = 8;
const BUBBLE = 64;

const STEP_ICONS = {
  click: FiMousePointer, plus: FiPlusCircle, form: FiFileText, search: FiSearch, upload: FiUpload, download: FiDownload,
  printer: FiPrinter, edit: FiEdit2, clock: FiClock, folder: FiFolder, users: FiUsers, trash: FiTrash2, shield: FiShield,
  chart: FiBarChart2, globe: FiGlobe, columns: FiColumns, link: FiLink, sidebar: FiSidebar,
};

const ENTITY_PAGE = {
  inquiries: '/inquiries', associateFollowUps: '/follow-up', studentFollowUps: '/student-follow-up',
  hallBookings: '/hall-booking', trainingSchedules: '/training-schedule', associates: '/associate-details', portals: '/portal', dailyReports: '/daily-report',
  diary: '/diary', users: '/users', departments: '/departments',
};

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return null;
}

function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), Math.max(lo, hi)); }

function clampToViewport(x, y) {
  return {
    x: clamp(x, MARGIN, window.innerWidth - BUBBLE - MARGIN),
    y: clamp(y, MARGIN, window.innerHeight - BUBBLE - MARGIN),
  };
}

function computePanelRect(anchor, vw, vh, compact) {
  const w = Math.min(400, vw - MARGIN * 2);
  const h = compact ? Math.min(260, vh - MARGIN * 2) : Math.min(560, vh - MARGIN * 2);
  const left = clamp(anchor.x + BUBBLE - w, MARGIN, vw - w - MARGIN);
  let top = anchor.y - h - 10;
  if (top < MARGIN) {
    top = anchor.y + BUBBLE + 10;
    if (top + h > vh - MARGIN) top = Math.max(MARGIN, vh - h - MARGIN);
  }
  return { left, top, width: w, height: compact ? 'auto' : h, maxHeight: vh - MARGIN * 2 };
}

const ARROW_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

function spotlight(selector, { duration = 20000 } = {}) {
  if (!selector) return null;
  let el = null;
  for (const s of selector.split(',').map(x => x.trim())) {
    try { el = document.querySelector(s); } catch { }
    if (el) break;
  }
  if (!el) return null;
  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  const ring = document.createElement('div');
  ring.className = 'am-spotlight-ring';
  const arrow = document.createElement('div');
  arrow.className = 'am-spotlight-arrow';
  arrow.innerHTML = ARROW_SVG;
  document.body.appendChild(ring);
  document.body.appendChild(arrow);

  const place = () => {
    const r = el.getBoundingClientRect();
    ring.style.top = `${r.top - 6}px`;
    ring.style.left = `${r.left - 6}px`;
    ring.style.width = `${r.width + 12}px`;
    ring.style.height = `${r.height + 12}px`;
    arrow.style.top = `${r.top + r.height / 2 - 13}px`;
    arrow.style.left = `${Math.max(2, r.left - 34)}px`;
  };
  place();
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
  const cleanup = () => {
    window.removeEventListener('scroll', place, true);
    window.removeEventListener('resize', place);
    ring.remove();
    arrow.remove();
  };
  const timer = setTimeout(cleanup, duration);
  return { cancel: () => { clearTimeout(timer); cleanup(); } };
}

function highlightByText(text) {
  if (!text) return;
  const needle = text.trim().toLowerCase();
  const cells = Array.from(document.querySelectorAll('td, .card, li, [role="row"]'));
  const hit = cells.find(c => (c.textContent || '').trim().toLowerCase() === needle)
    || cells.find(c => (c.textContent || '').toLowerCase().includes(needle));
  if (!hit) return;
  const row = hit.closest('tr') || hit;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.add('am-row-highlight');
  setTimeout(() => row.classList.remove('am-row-highlight'), 3600);
}

const fmt = n => new Intl.NumberFormat().format(n);

function describeFilters(q, entityMeta) {
  const bits = [];
  (q.filters || []).forEach(f => {
    const fld = entityMeta && entityMeta.fields.find(x => x.key === f.field);
    const label = fld ? fld.label : f.field;
    bits.push(`${label}: ${f.value}`);
  });
  if (q.text) bits.push(`matching "${q.text}"`);
  return bits;
}

function countSentence(res, q, entityMeta) {
  const base = res.presetLabels && res.presetLabels.length ? res.presetLabels.join(' + ') : res.entityLabel.toLowerCase();
  const bits = describeFilters(q, entityMeta);
  const where = res.country ? ` in ${res.country}` : '';
  const filt = bits.length ? ` (${bits.join(', ')})` : '';
  const when = res.range ? ` for ${res.range}${res.dateLabel && res.range !== 'all time' ? ` (by ${res.dateLabel})` : ''}` : '';
  return `${fmt(res.count)} ${base}${where}${filt}${when}.`;
}

export default function AiAssistantWidget() {
  const [openedOnce, setOpenedOnce] = useState(() => localStorage.getItem(OPENED_KEY) === '1');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(loadPos);
  const [dragging, setDragging] = useState(false);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [messages, setMessages] = useState([
    { from: 'bot', kind: 'text', text: 'Search data, find a page, or learn a process.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [tour, setTour] = useState(null);
  const dragRef = useRef({ down: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const bodyRef = useRef(null);
  const wrapRef = useRef(null);
  const spotRef = useRef(null);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onResize = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      setPos(p => (p ? clampToViewport(p.x, p.y) : p));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (window.innerWidth !== vp.w || window.innerHeight !== vp.h) setVp({ w: window.innerWidth, h: window.innerHeight });
    }, 1200);
    return () => clearInterval(t);
  }, [vp.w, vp.h]);

  const anchor = pos || { x: vp.w - BUBBLE - 22, y: vp.h - BUBBLE - 22 };
  const safeAnchor = clampToViewport(anchor.x, anchor.y);

  useEffect(() => {
    if (!open) return;
    axios.get('/assistant/catalog').then(res => setCatalog(res.data)).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open, busy]);

  useEffect(() => () => {
    if (spotRef.current) spotRef.current.cancel();
    clearTimeout(timerRef.current);
  }, []);

  const persistPos = (p) => {
    setPos(p);
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!openedOnce) {
      setOpenedOnce(true);
      try { localStorage.setItem(OPENED_KEY, '1'); } catch { }
    }
  };

  const onPointerDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    dragRef.current = { down: true, startX: e.clientX, startY: e.clientY, origX: r.left, origY: r.top, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.down) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    setPos(clampToViewport(dragRef.current.origX + dx, dragRef.current.origY + dy));
  };
  const onPointerUp = (e) => {
    if (!dragRef.current.down) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current.down = false;
    dragRef.current.moved = false;
    setDragging(false);
    if (wasMoved) setPos(cur => { if (cur) persistPos(cur); return cur; });
    else handleOpen();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const say = (text, extra = {}) => setMessages(m => [...m, { from: 'bot', kind: 'text', text, ...extra }]);
  const add = (msg) => setMessages(m => [...m, { from: 'bot', ...msg }]);

  const prefix = catalog?.me?.isAdmin ? '/admin' : '';
  const featureByKey = (key) => (catalog?.features || []).find(f => f.key === key);
  const featurePath = (f) => {
    if (f.key === 'dashboard' || (f.userOpen && !catalog?.me?.isAdmin)) return catalog?.me?.isAdmin ? '/admin' : '/dashboard';
    return `${prefix}${f.path}`;
  };

  const goToFeature = (f) => {
    setOpen(false);
    navigate(featurePath(f));
  };

  const goToItem = (item) => {
    setOpen(false);
    const key = item.entity;
    let path = null;
    if (key === 'applications' && item.country?._id) path = `/applications/${item.country._id}`;
    else if (key === 'countries') path = `/applications/${item._id}`;
    else if (key === 'testPrep' && item.slug) path = `${prefix}/test-prep/${item.slug}`;
    else if (key === 'contacts' && item.slug) path = `${prefix}/contacts/${item.slug}`;
    else if (key.startsWith('commission')) {
      const section = key === 'commissionShareholder' ? 'shareholder' : key === 'commissionDepartment' ? 'department' : 'associate';
      path = item.intakeId && item.country?._id ? `${prefix}/commission/${item.intakeId}/${item.country._id}/${section}` : `${prefix}/commission`;
    } else if (key === 'testPrep') path = `${prefix}/test-prep`;
    else if (key === 'contacts') path = `${prefix}/contacts`;
    else if (ENTITY_PAGE[key]) path = `${prefix}${ENTITY_PAGE[key]}`;
    if (!path) return;
    navigate(path);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (key === 'applications') {
        const row = document.querySelector(`[data-app-row="${item._id}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('am-row-highlight');
          setTimeout(() => row.classList.remove('am-row-highlight'), 3600);
          return;
        }
      }
      highlightByText(item.title);
    }, 1000);
  };

  const stopSpot = () => { if (spotRef.current) { spotRef.current.cancel(); spotRef.current = null; } };

  const showStep = (steps, idx, delay = 0) => {
    stopSpot();
    clearTimeout(timerRef.current);
    setTour({ steps, idx });
    const step = steps[idx];
    if (!step || !step.selector) return;
    timerRef.current = setTimeout(() => {
      let s = spotlight(step.selector);
      if (!s) {
        timerRef.current = setTimeout(() => { s = spotlight(step.selector); spotRef.current = s; }, 700);
      }
      spotRef.current = s;
    }, delay);
  };

  const startTour = (steps, intro) => {
    if (!steps.length) { say("There's nothing to teach there for your account."); return; }
    say(intro);
    showStep(steps, 0, 150);
  };

  const teachFeature = (feature) => {
    const steps = stepsForFeature(feature, catalog.me);
    startTour(steps, `Sure, here's ${feature.label}. I'll highlight each step. Use Next when you're ready.`);
  };

  const teachAll = () => {
    const feats = (catalog.features || []).filter(f => !['messages', 'settings'].includes(f.key));
    const steps = feats.flatMap(f => stepsForFeature(f, catalog.me));
    startTour(steps, `I'll walk you through all ${feats.length} areas you can use, one at a time. Press Stop whenever you like.`);
  };

  const tourNext = () => {
    if (!tour) return;
    const cur = tour.steps[tour.idx];
    const next = tour.idx + 1;
    if (next >= tour.steps.length) {
      stopSpot();
      setTour(null);
      say('That was everything. Ask me about anything else.');
      return;
    }
    let delay = 0;
    if (cur.navigate) {
      const f = featureByKey(cur.featureKey);
      if (f) { navigate(featurePath(f)); delay = 700; }
    }
    if (tour.steps[next].navigate && tour.steps[next].featureKey !== cur.featureKey) delay = Math.max(delay, 150);
    showStep(tour.steps, next, delay);
  };

  const tourBack = () => {
    if (!tour || tour.idx === 0) return;
    showStep(tour.steps, tour.idx - 1, 0);
  };

  const tourStop = () => { stopSpot(); clearTimeout(timerRef.current); setTour(null); };

  const runQuery = async (parsed) => {
    const { intent, whereHint, ...q } = parsed; // eslint-disable-line no-unused-vars
    try {
      const res = await axios.post('/assistant/query', q);
      const d = res.data;
      const entityMeta = (catalog?.entities || []).find(e => e.key === d.entity);
      if (d.op === 'count') {
        add({ kind: 'count', count: d.count, text: countSentence(d, q, entityMeta) });
      } else if (d.op === 'list') {
        if (!d.items.length) add({ kind: 'text', text: `No ${d.entityLabel.toLowerCase()} matched${d.range ? ` for ${d.range}` : ''}.` });
        else add({ kind: 'list', text: `${fmt(d.count)} ${d.presetLabels?.length ? d.presetLabels.join(' + ') : d.entityLabel.toLowerCase()}${d.country ? ` in ${d.country}` : ''}${d.range ? ` for ${d.range}` : ''}${d.count > d.items.length ? `, showing ${d.items.length}` : ''}:`, items: d.items });
      } else if (d.op === 'top') {
        if (!d.groups.length) add({ kind: 'text', text: 'Nothing to rank for that.' });
        else add({ kind: 'top', text: `${q.order === 'asc' ? 'Lowest' : 'Highest'} by ${d.groupLabel}${d.presetLabels?.length ? ` (${d.presetLabels.join(' + ')})` : ''}${d.range ? ` for ${d.range}` : ''}:`, groups: d.groups, total: d.count });
      } else if (d.op === 'duplicates') {
        if (!d.duplicates.length) add({ kind: 'text', text: `No duplicate ${d.entityLabel.toLowerCase()} found.` });
        else add({ kind: 'dups', text: `${d.duplicates.length} name${d.duplicates.length === 1 ? '' : 's'} appear more than once:`, dups: d.duplicates });
      }
      if (whereHint) {
        const hints = [];
        const order = d.entity === 'applications' ? ['reports', 'applications'] : [];
        order.forEach(k => { const f = featureByKey(k); if (f) hints.push(f); });
        if (hints.length) add({ kind: 'goto', text: 'You can also see this yourself here:', features: hints });
      }
    } catch (err) {
      say(err.response?.data?.message || "I couldn't work that out right now.");
    }
  };

  const runFind = async (text) => {
    try {
      const res = await axios.get('/assistant/search', { params: { q: text } });
      const groups = res.data.results || [];
      if (!groups.length) { say(`I couldn't find anything for "${text}". Check the spelling, or it may not be added yet.`); return; }
      add({ kind: 'find', text: `Here's what I found for "${text}":`, groups });
    } catch (err) {
      say(err.response?.data?.message || "I couldn't search right now.");
    }
  };

  const handleSend = async (rawText) => {
    const text = (rawText ?? input).trim();
    if (!text || busy) return;
    setMessages(m => [...m, { from: 'user', kind: 'text', text }]);
    setInput('');

    if (!catalog) { say('One moment, I am still loading your data. Please ask again in a second.'); return; }
    const parsed = parseAssistantInput(text, catalog);
    setBusy(true);
    try {
      switch (parsed.intent) {
        case 'greet': say(`Hi ${catalog.me.name ? catalog.me.name.split(' ')[0] : 'there'}! What would you like to know?`); break;
        case 'thanks': say("You're welcome!"); break;
        case 'help': add({ kind: 'caps' }); break;
        case 'denied': add({ kind: 'denied', what: parsed.what }); break;
        case 'goto': {
          const f = featureByKey(parsed.feature);
          if (!f) { add({ kind: 'denied', what: parsed.feature }); break; }
          add({ kind: 'goto', text: `${f.label} is in the sidebar. ${f.desc ? f.desc + '.' : ''}`, features: [f] });
          stopSpot();
          spotRef.current = spotlight(sidebarSelector(f), { duration: 6000 });
          break;
        }
        case 'teach': {
          if (parsed.all) { teachAll(); break; }
          let f = parsed.feature ? featureByKey(parsed.feature) : pickFeatureForTopic(parsed.topic, catalog.features);
          if (f) { teachFeature(f); break; }
          const r = pickRestricted(parsed.topic, catalog);
          if (r) { add({ kind: 'denied', what: r }); break; }
          add({ kind: 'text', text: `Which one? I can teach: ${catalog.features.filter(x => !['dashboard', 'messages', 'settings'].includes(x.key)).map(x => x.label).join(', ')}. Or say "teach me all".` });
          break;
        }
        case 'query': await runQuery(parsed); break;
        case 'find': await runFind(parsed.text); break;
        default:
          say("I didn't understand that. I can count, list, rank or find anything in your data, take you to a page, or teach you a process. Press the ? button for the full list.");
      }
    } finally {
      setBusy(false);
    }
  };

  const compact = !!tour;
  const rect = computePanelRect(safeAnchor, vp.w, vp.h, compact);
  const bubbleStyle = pos ? { left: safeAnchor.x, top: safeAnchor.y, right: 'auto', bottom: 'auto' } : undefined;
  const curStep = tour ? tour.steps[tour.idx] : null;
  const StepIcon = curStep ? (STEP_ICONS[curStep.icon] || FiArrowRight) : null;

  const renderItems = (items) => (
    <div className="am-choice-list">
      {items.map(it => (
        <button key={`${it.entity}-${it._id}`} className="am-choice" onClick={() => goToItem(it)}>
          <span className="am-choice-title">{it.title}</span>
          {it.subtitle && <span className="am-choice-sub">{it.subtitle}</span>}
          {it.country && <span className="am-choice-sub">{it.country.name}</span>}
          {it.fields && it.fields.length > 0 && (
            <span className="am-choice-fields">
              {it.fields.slice(0, 6).map(f => <span key={f.label}><b>{f.label}:</b> {f.value}</span>)}
            </span>
          )}
          <FiArrowRight className="am-choice-go" />
        </button>
      ))}
    </div>
  );

  const renderMessage = (m, i) => {
    if (m.from === 'user') return <div key={i} className="am-msg am-msg-user"><div className="am-bubble">{m.text}</div></div>;
    return (
      <div key={i} className="am-msg am-msg-bot">
        {m.kind === 'caps' && (
          <div className="am-bubble">
            <strong>I can:</strong>
            <ul className="am-caps">{CAPABILITIES.map(c => <li key={c}>{c}</li>)}</ul>
            <span className="am-caps-note">Shows only what your access allows.</span>
          </div>
        )}
        {m.kind === 'denied' && (
          <div className="am-bubble am-denied"><FiLock /> <span>You don't have access to {m.what}. Ask a Super Admin if you need it.</span></div>
        )}
        {m.kind === 'count' && (
          <div className="am-bubble am-count"><span className="am-count-num">{fmt(m.count)}</span><span>{m.text.replace(/^[\d,.\s]+/, '')}</span></div>
        )}
        {(m.kind === 'text' || m.kind === 'goto') && m.text && <div className="am-bubble">{m.text}</div>}
        {m.kind === 'goto' && (
          <div className="am-choice-list">
            {m.features.map(f => (
              <button key={f.key} className="am-inline-btn" onClick={() => goToFeature(f)}><FiNavigation /> Open {f.label}</button>
            ))}
          </div>
        )}
        {m.kind === 'list' && <><div className="am-bubble">{m.text}</div>{renderItems(m.items)}</>}
        {m.kind === 'find' && (
          <>
            <div className="am-bubble">{m.text}</div>
            {m.groups.map(g => (
              <div key={g.entity} className="am-group">
                <div className="am-group-title">{g.entityLabel}{g.total > g.items.length ? ` (${g.total})` : ''}</div>
                {renderItems(g.items)}
              </div>
            ))}
          </>
        )}
        {m.kind === 'top' && (
          <>
            <div className="am-bubble">{m.text}</div>
            <div className="am-bars">
              {m.groups.map(g => (
                <div key={g.name} className="am-bar-row">
                  <div className="am-bar-label" title={g.name}>{g.name}</div>
                  <div className="am-bar-track"><div className="am-bar-fill" style={{ width: `${Math.max(4, (g.count / m.groups[0].count) * 100)}%` }} /></div>
                  <div className="am-bar-num">{fmt(g.count)}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {m.kind === 'dups' && (
          <>
            <div className="am-bubble">{m.text}</div>
            <div className="am-choice-list">
              {m.dups.map(d => (
                <button key={`${d.name}-${d.country}`} className="am-choice" onClick={() => handleSend(d.name)}>
                  <span className="am-choice-title">{d.name}</span>
                  <span className="am-choice-sub">{d.count} times{d.country ? ` · ${d.country}` : ''}</span>
                  <FiArrowRight className="am-choice-go" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        ref={wrapRef}
        className={`am-bubble-wrap ${openedOnce ? 'am-settled' : 'am-bouncing'} ${dragging ? 'am-dragging' : ''}`}
        style={bubbleStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {!open && !openedOnce && <div className="am-speech-bubble">AI Assistant</div>}
        {!open && <span className="am-grip" title="Drag to move"><FiMove size={11} /></span>}
        <button type="button" className="am-bubble-btn" aria-label="Open AI assistant">
          <AssistantMascot waving={!openedOnce} />
        </button>
      </div>

      {open && (
        <div className={`am-panel ${compact ? 'am-panel-compact' : ''}`} style={rect}>
          <div className="am-panel-header">
            <AssistantMascot size={30} />
            <div>
              <strong>CRM Assistant</strong>
              <span>Data assistant</span>
            </div>
            <button className="am-icon-btn" title="What I can do" onClick={() => { setMessages(m => [...m, { from: 'user', kind: 'text', text: 'Help' }, { from: 'bot', kind: 'caps' }]); }}><FiHelpCircle /></button>
            <button className="am-icon-btn" title="Close" onClick={() => setOpen(false)}><FiX /></button>
          </div>

          {tour && curStep && (
            <div className="am-guide-banner">
              <div className="am-guide-icon">{StepIcon && <StepIcon />}</div>
              <div className="am-guide-text">
                <strong>{curStep.title}</strong>
                <span className="am-guide-count">step {tour.idx + 1} of {tour.steps.length}</span>
                <p>{curStep.text}</p>
              </div>
              <div className="am-guide-actions">
                <button onClick={tourNext}>{tour.idx + 1 >= tour.steps.length ? 'Done' : 'Next'}</button>
                <button className="am-guide-stop" onClick={tourBack} disabled={tour.idx === 0}>Back</button>
                <button className="am-guide-stop" onClick={tourStop}>Stop</button>
              </div>
            </div>
          )}

          {!compact && (
            <>
              <div className="am-body" ref={bodyRef}>
                {messages.map(renderMessage)}
                {busy && <div className="am-msg am-msg-bot"><div className="am-bubble am-typing">...</div></div>}
              </div>
              <form className="am-input-row" onSubmit={e => { e.preventDefault(); handleSend(); }}>
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about your data..." disabled={busy} />
                <button type="submit" disabled={busy || !input.trim()} aria-label="Send"><FiSend /></button>
              </form>
            </>
          )}
          {compact && <div className="am-tour-done"><FiCheckCircle /> Tour in progress. Chat returns when you press Stop.</div>}
        </div>
      )}
    </>
  );
}

function pickRestricted(topic, catalog) {
  const t = ` ${String(topic || '').toLowerCase()} `;
  const hit = (catalog.restricted || []).find(r => [r.label.toLowerCase(), ...(r.aliases || [])].some(n => n && n.length > 3 && t.includes(` ${n} `)));
  return hit ? hit.label : null;
}
