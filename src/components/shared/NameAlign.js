import { useEffect } from 'react';

const NAME_HEADERS = new Set([
  'name', 'name of applicant', 'name of applicants', 'applicant name', 'applicants name',
  'student name', 'students name', 'candidate name', 'full name',
]);

function headerText(th) {
  return (th.textContent || '').replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function align() {
  document.querySelectorAll('table').forEach(table => {
    const headRow = table.tHead && table.tHead.rows[0];
    if (!headRow) return;
    const idx = [];
    Array.from(headRow.cells).forEach((th, i) => {
      if (NAME_HEADERS.has(headerText(th))) {
        idx.push(i);
        th.classList.add('th-left');
      }
    });
    if (!idx.length) return;
    Array.from(table.tBodies).forEach(body => {
      Array.from(body.rows).forEach(row => {
        idx.forEach(i => {
          const td = row.cells[i];
          if (td && td.colSpan <= 1) td.classList.add('td-left');
        });
      });
    });
  });
}

export default function NameAlign() {
  useEffect(() => {
    let frame = null;
    const schedule = () => {
      if (frame) return;
      frame = window.setTimeout(() => { frame = null; align(); }, 120);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => { observer.disconnect(); if (frame) window.clearTimeout(frame); };
  }, []);
  return null;
}
