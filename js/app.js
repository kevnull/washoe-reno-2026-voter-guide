'use strict';

// Tie the data fetch to the asset version (?v=) so a deploy never serves stale cached JSON.
const _vm = document.currentScript && document.currentScript.src.match(/[?&]v=([^&]+)/);
const ASSET_V = _vm ? _vm[1] : '';

const state = { party: 'all', level: 'all', issue: 'all', q: '' };
let DATA = null;

// --- My Ballot: one pick per race, persisted ---
const BALLOT_KEY = 'wrvg-ballot-v1';
let selections = loadSelections();
function loadSelections() { try { return JSON.parse(localStorage.getItem(BALLOT_KEY) || '{}') || {}; } catch (e) { return {}; } }
function saveSelections() { try { localStorage.setItem(BALLOT_KEY, JSON.stringify(selections)); } catch (e) {} }
const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = s => (s == null ? '' : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
const slug = s => s.replace(/[^\w]+/g, '-').toLowerCase();
function initials(name) {
  const parts = name.replace(/["'][^"']*["']/g, '').replace(/[().]/g, '').trim().split(/\s+/).filter(Boolean);
  const f = parts[0] ? parts[0][0] : '';
  const l = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (f + l).toUpperCase() || '?';
}
function avatarHtml(c, extra) {
  const cls = `avatar avatar--${c.party || 'np'}${extra ? ' ' + extra : ''}`;
  const ini = esc(initials(c.name));
  if (c.photo) {
    return `<div class="${cls}"><img src="${esc(c.photo)}" alt="${esc(c.name)}" loading="lazy" ` +
      `onerror="this.parentNode.textContent='${ini}'"></div>`;
  }
  return `<div class="${cls}">${ini}</div>`;
}

const LEVEL_ORDER = ['Federal', 'Statewide', 'State Legislature', 'Washoe', 'Reno', 'Sparks'];
const LEVEL_LABEL = {
  Federal: 'Federal', Statewide: 'Nevada Statewide', 'State Legislature': 'Nevada Legislature',
  Washoe: 'Washoe County', Reno: 'City of Reno', Sparks: 'City of Sparks',
};

function ytLink(url, ts) {
  if (!url) return url;
  if (ts == null) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${ts}s`;
}

async function init() {
  try {
    const res = await fetch('data/candidates.json' + (ASSET_V ? '?v=' + ASSET_V : ''));
    DATA = await res.json();
  } catch (e) {
    $('#app').innerHTML = '<div class="empty-state"><h2>Could not load candidate data.</h2><p>If you opened this file directly, run a local server (e.g. <code>python3 -m http.server</code>) — browsers block <code>fetch()</code> on <code>file://</code>.</p></div>';
    return;
  }
  hydrateChrome();
  buildControls();
  wireEvents();
  render();
  updateBallotBar();
}

function hydrateChrome() {
  const m = DATA.meta;
  $('#lede').textContent = m.disclaimer;
  $('#rulesText').textContent = m.primaryRules;
  $('#footerNote').textContent = `${DATA.candidates.length} candidates across ${DATA.races.length} races · early voting ${m.earlyVoting} · Election Day ${fmtDate(m.electionDate)}.`;
  // countdown
  const days = Math.ceil((new Date(m.electionDate + 'T00:00:00') - new Date('2026-06-05T12:00:00')) / 864e5);
  $('#countdown').textContent = days > 0 ? `🗳️  ${days} day${days === 1 ? '' : 's'} until Election Day — ${fmtDate(m.electionDate)}` : `Election Day is ${fmtDate(m.electionDate)}`;
}
function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function buildControls() {
  const lvls = [...new Set(DATA.races.map(r => r.level))].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
  const lsel = $('#levelSel');
  lvls.forEach(l => { const o = el('option'); o.value = l; o.textContent = LEVEL_LABEL[l] || l; lsel.appendChild(o); });
  const isel = $('#issueSel');
  Object.entries(DATA.issues).forEach(([k, v]) => { const o = el('option'); o.value = k; o.textContent = `${v.icon} ${v.label}`; isel.appendChild(o); });
}

function wireEvents() {
  $('#partySel').addEventListener('change', e => { state.party = e.target.value; render(); });
  $('#levelSel').addEventListener('change', e => { state.level = e.target.value; render(); });
  $('#issueSel').addEventListener('change', e => { state.issue = e.target.value; render(); });
  $('#searchBox').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); render(); });

  const app = $('#app');
  app.addEventListener('click', e => {
    const details = e.target.closest('[data-open-cand]');
    if (details) { e.preventDefault(); openDrawer(details.dataset.openCand); return; }
    const cell = e.target.closest('.cell:not(.empty)');
    if (cell) { openDrawer(cell.dataset.cand, cell.dataset.issue); return; }
    const pick = e.target.closest('.cand-cell');
    if (pick) { toggleSelect(pick.closest('tr')); }
  });
  app.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pick = e.target.closest('.cand-cell');
    if (pick) { e.preventDefault(); toggleSelect(pick.closest('tr')); }
  });

  $('#viewBallot').addEventListener('click', openBallot);
  $('#clearBallot').addEventListener('click', clearBallot);
  $('#ballotClose').addEventListener('click', () => $('#ballotModal').hidden = true);
  $('#ballotModal').addEventListener('click', e => { if (e.target.id === 'ballotModal') $('#ballotModal').hidden = true; });
  $('#ballotPrint').addEventListener('click', () => window.print());
  $('#ballotEmail').addEventListener('click', emailBallot);
  $('#ballotCopy').addEventListener('click', copyBallot);
  $('#ballotImage').addEventListener('click', imageBallot);
  // tooltip
  app.addEventListener('mouseover', e => { const c = e.target.closest('.cell:not(.empty)'); if (c) showTip(c); });
  app.addEventListener('mousemove', moveTip);
  app.addEventListener('mouseout', e => { if (e.target.closest('.cell')) hideTip(); });

  $('#filtersToggle').addEventListener('click', () => {
    const c = $('#controls'); const open = c.classList.toggle('open');
    $('#filtersToggle').setAttribute('aria-expanded', String(open));
  });
  $('#backdrop').addEventListener('click', closeDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#methodBtn').addEventListener('click', openMethod);
  $('#methodClose').addEventListener('click', () => $('#methodModal').hidden = true);
  $('#methodModal').addEventListener('click', e => { if (e.target.id === 'methodModal') $('#methodModal').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); $('#methodModal').hidden = true; $('#ballotModal').hidden = true; } });
}

/* ---------- Eligibility ---------- */
// Returns {eligible:bool, reason:string} for the selected party against a race.
function eligibility(race) {
  if (state.party === 'all') return { eligible: true, reason: '' };
  if (race.type === 'nonpartisan') return { eligible: true, reason: '' };
  // partisan race + a specific party selected
  if (state.party === 'Nonpartisan') return { eligible: false, reason: 'Nonpartisan voters cannot vote in partisan primaries.' };
  const hasParty = DATA.candidates.some(c => c.raceId === race.id && c.party === state.party);
  if (!hasParty) return { eligible: false, reason: `No ${state.party} candidate filed in this primary.` };
  return { eligible: true, reason: '' };
}

function candidatesFor(race, elig) {
  let cs = DATA.candidates.filter(c => c.raceId === race.id);
  // Party filter applies only to ELIGIBLE partisan races: an R/D voter sees just their party.
  // For races they can't vote (other-party primaries), show everyone — dimmed but informative.
  if (elig && elig.eligible && race.type === 'partisan' && (state.party === 'Democratic' || state.party === 'Republican')) {
    cs = cs.filter(c => c.party === state.party);
  }
  if (state.q) {
    cs = cs.filter(c => matchCand(c, race));
  }
  return cs;
}
function matchCand(c, race) {
  const hay = [c.name, race.title, c.bio, ...Object.values(c.positions || {}).flatMap(p => [p.stance, p.quote])].join(' ').toLowerCase();
  return hay.includes(state.q);
}

/* ---------- Render ---------- */
function render() {
  updateEligNote();
  const app = $('#app');
  app.innerHTML = '';

  const races = DATA.races.filter(r => state.level === 'all' || r.level === state.level);
  const groups = {};
  let shownRaces = 0, shownCands = 0;

  for (const race of races) {
    const elig = eligibility(race);
    let cands = candidatesFor(race, elig);
    // issue focus: keep only candidates that have that issue, and only races with any
    if (state.issue !== 'all') cands = cands.filter(c => c.positions && c.positions[state.issue]);
    if (state.q && cands.length === 0) continue;          // search prunes empty races
    if (state.issue !== 'all' && cands.length === 0) continue;
    (groups[race.level] ||= []).push({ race, cands, elig });
    shownRaces++; shownCands += cands.length;
  }

  $('#statRow').innerHTML = `<span><b>${shownRaces}</b> races shown</span><span><b>${shownCands}</b> candidates</span>` +
    (state.party !== 'all' ? `<span>Filtered to what a <b>${state.party === 'Nonpartisan' ? 'nonpartisan' : state.party}</b> voter decides</span>` : '');
  const ftl = $('#filtersToggleLabel');
  if (ftl) ftl.textContent = `Filters · ${shownRaces} races` + (state.party !== 'all' ? ` · ${state.party === 'Nonpartisan' ? 'Nonpartisan' : state.party}` : '') + (state.q || state.level !== 'all' || state.issue !== 'all' ? ' · active' : '');

  const levels = Object.keys(groups).sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
  buildJumpNav(levels, groups);
  if (!levels.length) {
    app.appendChild(el('div', 'empty-state', '<h2>No races match your filters.</h2><p>Try “Show everything” or clear the search.</p>'));
    return;
  }
  for (const lvl of levels) {
    const g = el('section', 'level-group');
    g.id = 'lvl-' + slug(lvl);
    const head = el('button', 'level-head');
    head.type = 'button';
    head.setAttribute('aria-expanded', 'true');
    head.innerHTML = `<h2>${LEVEL_LABEL[lvl] || lvl}</h2><span class="lvl-count">${groups[lvl].length} race${groups[lvl].length === 1 ? '' : 's'}</span><span class="toggle-more" aria-hidden="true"></span>`;
    head.addEventListener('click', () => {
      const collapsed = g.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', String(!collapsed));
    });
    const body = el('div', 'level-body');
    groups[lvl].forEach(item => body.appendChild(raceCard(item)));
    g.appendChild(head); g.appendChild(body);
    app.appendChild(g);
  }
}

function buildJumpNav(levels, groups) {
  const jn = $('#jumpnav');
  if (!levels.length) { jn.innerHTML = ''; return; }
  jn.innerHTML = '<span class="jn-label">Jump to</span>';
  levels.forEach(lvl => {
    const a = el('a', 'jn-chip');
    a.href = '#lvl-' + slug(lvl);
    a.innerHTML = `${LEVEL_LABEL[lvl] || lvl} <span class="jn-n">${groups[lvl].length}</span>`;
    a.addEventListener('click', e => { e.preventDefault(); jumpTo('lvl-' + slug(lvl)); });
    jn.appendChild(a);
  });
  const sel = el('select', 'jn-select');
  let opts = '<option value="">Jump to a race…</option>';
  levels.forEach(lvl => {
    opts += `<optgroup label="${esc(LEVEL_LABEL[lvl] || lvl)}">`;
    groups[lvl].forEach(item => { opts += `<option value="race-${esc(item.race.id)}">${esc(item.race.title)}</option>`; });
    opts += '</optgroup>';
  });
  sel.innerHTML = opts;
  sel.addEventListener('change', e => { if (e.target.value) { jumpTo(e.target.value); e.target.value = ''; } });
  jn.appendChild(sel);
}
function jumpTo(id) {
  const node = document.getElementById(id);
  if (!node) return;
  // On mobile, collapse the filter panel so the target is actually visible
  const ctrl = $('#controls');
  if (ctrl.classList.contains('open') && window.matchMedia('(max-width: 820px)').matches) {
    ctrl.classList.remove('open');
    $('#filtersToggle').setAttribute('aria-expanded', 'false');
  }
  const grp = node.closest('.level-group') || node;
  if (grp.classList.contains('collapsed')) { grp.classList.remove('collapsed'); const h = grp.querySelector('.level-head'); if (h) h.setAttribute('aria-expanded', 'true'); }
  requestAnimationFrame(() => node.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function updateEligNote() {
  const note = $('#eligNote');
  const map = {
    all: 'Showing every race and candidate on the Washoe ballot.',
    Democratic: 'You decide Democratic partisan primaries + all nonpartisan races (mayors, council, school board, judges).',
    Republican: 'You decide Republican partisan primaries + all nonpartisan races (mayors, council, school board, judges).',
    Nonpartisan: 'You can’t vote partisan primaries, but you DO vote every nonpartisan race — those are dimmed-out below for partisan offices only.',
  };
  note.textContent = map[state.party] || '';
}

function raceCard({ race, cands, elig }) {
  const card = el('article', 'race-card' + (elig.eligible ? '' : ' ineligible'));
  card.id = 'race-' + race.id;
  // header
  const head = el('div', 'race-head');
  const badges = [
    `<span class="badge badge--${race.type}">${race.type === 'partisan' ? 'Partisan · closed' : 'Nonpartisan · open to all'}</span>`,
    race.tier === 'marquee' ? '<span class="badge badge--marquee">Key race</span>' : '',
    !elig.eligible ? `<span class="ineligible-tag">Not on your ballot</span>` : '',
  ].join(' ');
  head.innerHTML = `<div class="race-title-row"><h3>${esc(race.title)}</h3>${badges}</div>` +
    (race.notes ? `<p class="race-notes">${esc(race.notes)}</p>` : '') +
    (!elig.eligible && elig.reason ? `<p class="race-meta">${esc(elig.reason)}</p>` : '');
  card.appendChild(head);

  // No candidates in dataset → reference race (e.g. uncontested district). Show a slim note, no matrix.
  if (cands.length === 0) {
    card.classList.add('reference-race');
    card.appendChild(el('div', 'no-primary-note', '➜ No primary contest here on June 9 — candidates (if any) advance straight to the November general election.'));
    return card;
  }

  const sig = renderSignals(race, cands);
  if (sig) card.appendChild(sig);

  // determine issue columns
  let cols;
  if (state.issue !== 'all') cols = [state.issue];
  else {
    const used = new Set();
    cands.forEach(c => Object.keys(c.positions || {}).forEach(k => used.add(k)));
    cols = Object.keys(DATA.issues).filter(k => used.has(k));
  }

  const scroll = el('div', 'matrix-scroll');
  const table = el('table', 'matrix');
  // head row
  let thead = '<thead><tr><th class="cand-col">Candidate</th>';
  if (cols.length === 0) thead += '<th>Positions</th>';
  cols.forEach(k => {
    const iss = DATA.issues[k];
    thead += `<th class="issue-h" title="${esc(iss.label)} — ${esc(iss.desc)}"><span class="ic">${iss.icon}</span>${esc(iss.label)}</th>`;
  });
  thead += '</tr></thead>';
  table.innerHTML = thead;

  const tb = el('tbody');
  tb.setAttribute('role', 'radiogroup');
  tb.setAttribute('aria-label', 'Pick one candidate for ' + race.title);
  cands.forEach(c => {
    const tr = el('tr');
    tr.dataset.race = race.id;
    tr.dataset.cand = c.id;
    if (selections[race.id] === c.id) tr.classList.add('selected');
    tr.appendChild(candCell(c, race));
    if (cols.length === 0) {
      const td = el('td'); td.colSpan = 1;
      td.innerHTML = '<div class="no-positions-row" style="padding:11px 12px">No sourced positions found yet.</div>';
      tr.appendChild(td);
    }
    cols.forEach(k => tr.appendChild(issueCell(c, k)));
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  scroll.appendChild(table);
  card.appendChild(scroll);
  return card;
}

/* ---------- My Ballot ---------- */
function toggleSelect(tr) {
  if (!tr) return;
  const race = tr.dataset.race, cand = tr.dataset.cand;
  const tbody = tr.parentNode;
  if (selections[race] === cand) {
    delete selections[race];
    tr.classList.remove('selected');
    tr.querySelector('.cand-cell')?.setAttribute('aria-checked', 'false');
  } else {
    selections[race] = cand;
    [...tbody.children].forEach(r => {
      const on = r === tr;
      r.classList.toggle('selected', on);
      r.querySelector('.cand-cell')?.setAttribute('aria-checked', String(on));
    });
  }
  saveSelections();
  updateBallotBar();
}

function updateBallotBar() {
  const n = Object.keys(selections).length;
  const bar = $('#ballotBar');
  bar.hidden = n === 0;
  if (n) $('#ballotCount').innerHTML = `<b>${n}</b> of ${DATA.races.length} race${n === 1 ? '' : 's'} picked`;
}

function clearBallot() {
  if (!confirm('Clear all your ballot picks?')) return;
  selections = {};
  saveSelections();
  updateBallotBar();
  $('#ballotModal').hidden = true;
  render();
}

function ballotGroups() {
  // returns ordered [{level, races:[{race, cand}]}] for selected races
  const out = {};
  for (const r of DATA.races) {
    const cid = selections[r.id];
    if (!cid) continue;
    const cand = DATA.candidates.find(c => c.id === cid);
    if (!cand) continue;
    (out[r.level] ||= []).push({ race: r, cand });
  }
  return Object.keys(out)
    .sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))
    .map(level => ({ level, races: out[level] }));
}

function openBallot() {
  const groups = ballotGroups();
  const sheet = $('#ballotSheet');
  const total = DATA.races.length;
  const picked = Object.keys(selections).length;
  let html = `<div class="bs-head"><h2 id="ballotTitle">My Sample Ballot</h2>` +
    `<p class="bs-sub">Washoe County &amp; Reno · Primary Election · Tuesday, June 9, 2026</p>` +
    `<p class="bs-meta">${picked} of ${total} races selected · Bring this as a reference; it is not an official ballot.</p></div>`;
  if (!groups.length) {
    html += '<p class="bs-empty">No picks yet. Tap a candidate in any race to add them.</p>';
  } else {
    for (const g of groups) {
      html += `<div class="bs-level"><h3>${LEVEL_LABEL[g.level] || g.level}</h3>`;
      for (const { race, cand } of g.races) {
        const party = race.type === 'partisan' && cand.party ? ` <span class="bs-party">(${esc(cand.party)})</span>` : '';
        html += `<div class="bs-row"><span class="bs-race">${esc(race.title)}</span>` +
          `<span class="bs-pick">✓ ${esc(cand.name)}${party}${cand.incumbent ? ' <span class="bs-inc">· incumbent</span>' : ''}</span></div>`;
      }
      html += `</div>`;
    }
  }
  html += `<p class="bs-foot">Built with the independent Washoe/Reno voter guide · kevnull.github.io/washoe-reno-2026-voter-guide · Verify your official ballot at washoecounty.gov/voters</p>`;
  sheet.innerHTML = html;
  $('#ballotModal').hidden = false;
}

function ballotText() {
  const groups = ballotGroups();
  let lines = ['MY SAMPLE BALLOT — Washoe County & Reno', 'Primary Election · Tuesday, June 9, 2026', ''];
  for (const g of groups) {
    lines.push((LEVEL_LABEL[g.level] || g.level).toUpperCase());
    for (const { race, cand } of g.races) {
      const party = race.type === 'partisan' && cand.party ? ` (${cand.party})` : '';
      lines.push(`  • ${race.title}: ${cand.name}${party}`);
    }
    lines.push('');
  }
  lines.push('Reference only — not an official ballot. Verify at washoecounty.gov/voters');
  lines.push('Guide: https://kevnull.github.io/washoe-reno-2026-voter-guide/');
  return lines.join('\n');
}

function emailBallot() {
  const subject = 'My June 9, 2026 sample ballot (Washoe/Reno)';
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(ballotText())}`;
}

async function copyBallot() {
  try { await navigator.clipboard.writeText(ballotText()); flashBtn('#ballotCopy', '✓ Copied'); }
  catch (e) { alert('Copy failed — select the text manually.'); }
}

function flashBtn(sel, txt) {
  const b = $(sel); const old = b.textContent; b.textContent = txt;
  setTimeout(() => { b.textContent = old; }, 1500);
}

async function imageBallot() {
  const btn = $('#ballotImage'); const old = btn.textContent; btn.textContent = '…rendering';
  try {
    if (!window.html2canvas) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
    const canvas = await window.html2canvas($('#ballotSheet'), { backgroundColor: '#ffffff', scale: 2 });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'my-washoe-reno-ballot-2026.png';
    a.click();
    btn.textContent = old;
  } catch (e) {
    btn.textContent = old;
    alert('Image export unavailable (offline?). Use “Print / Save PDF” instead — it also makes a clean screenshot-ready page.');
  }
}

function fmtMoney(n) {
  if (n == null) return null;
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + n;
}

function renderSignals(race, cands) {
  const funded = cands.filter(c => c.funding && (c.funding.raised != null || c.funding.cashOnHand != null));
  const endorsed = cands.filter(c => c.endorsements && c.endorsements.length);
  const polls = race.polls || [];
  if (!funded.length && !endorsed.length && !polls.length) return null;

  const det = el('details', 'signals');
  const bits = ['money', endorsed.length && 'endorsements', polls.length && 'polls'].filter(Boolean);
  const sum = el('summary', 'signals-summary');
  sum.innerHTML = `<span class="sig-title">📊 Race signals — ${bits.join(' · ')}</span><span class="sig-toggle" aria-hidden="true"></span>`;
  det.appendChild(sum);
  const body = el('div', 'signals-body');
  let html = '';

  if (funded.length) {
    const maxR = Math.max(1, ...funded.map(c => c.funding.raised || 0));
    const sorted = [...funded].sort((a, b) => (b.funding.raised ?? b.funding.cashOnHand ?? 0) - (a.funding.raised ?? a.funding.cashOnHand ?? 0));
    const srcs = new Map();
    let rows = '';
    for (const c of sorted) {
      const f = c.funding;
      const pct = f.raised != null ? Math.max(3, Math.round(f.raised / maxR * 100)) : 0;
      const amt = [f.raised != null ? `${fmtMoney(f.raised)} raised` : null, f.cashOnHand != null ? `${fmtMoney(f.cashOnHand)} cash` : null].filter(Boolean).join(' · ');
      rows += `<div class="fund-row"><span class="fund-name">${esc(c.name)}</span>` +
        `<span class="fund-track">${f.raised != null ? `<span class="fund-fill" style="width:${pct}%"></span>` : ''}</span>` +
        `<span class="fund-amt">${esc(amt)}</span></div>`;
      if (f.source && f.source.url) srcs.set(f.source.url, f.source.label || 'source');
    }
    const srcLinks = [...srcs].map(([url, label]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`).join(' · ');
    html += `<div class="sig-section"><h4>💰 Fundraising this cycle</h4>${rows}` +
      `<p class="sig-src">Most recent campaign-finance filings; figures rounded. ${srcLinks ? 'Source: ' + srcLinks : ''}</p></div>`;
  }

  if (endorsed.length) {
    let rows = '';
    for (const c of endorsed) {
      const list = c.endorsements.map(e => e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.by)}</a>` : esc(e.by)).join(', ');
      rows += `<div class="endo-row"><span class="endo-name">${esc(c.name)}</span><span class="endo-list">${list}</span></div>`;
    }
    html += `<div class="sig-section"><h4>🤝 Notable endorsements</h4>${rows}</div>`;
  }

  if (polls.length) {
    let rows = '';
    for (const p of polls) {
      rows += `<div class="poll-row"><div class="poll-summary">${esc(p.summary)}</div>` +
        `<div class="poll-meta">${[p.sponsor, p.date, p.sampleSize].filter(Boolean).map(esc).join(' · ')}` +
        `${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener">source ↗</a>` : ''}</div></div>`;
    }
    html += `<div class="sig-section"><h4>📊 Polls</h4>` +
      `<p class="sig-caveat">⚠️ No independent public <em>primary</em> polls exist for this ballot. Entries below may be internal/campaign or general-election polls — read each label.</p>${rows}</div>`;
  }

  body.innerHTML = html;
  det.appendChild(body);
  return det;
}

function candCell(c, race) {
  const td = el('td', 'cand-cell');
  td.tabIndex = 0;
  td.setAttribute('role', 'radio');
  td.setAttribute('aria-checked', String(selections[race.id] === c.id));
  td.title = 'Click to pick ' + c.name + ' for your ballot';
  const pills = [];
  if (race.type === 'partisan' && c.party) pills.push(`<span class="pill pill--${esc(c.party)}">${esc(c.party === 'Nonpartisan' ? 'NP' : c.party.slice(0, 3))}</span>`);
  if (c.incumbent) pills.push('<span class="pill pill--inc">Incumbent</span>');
  td.innerHTML = `<div class="cand-flex">` +
    `<span class="pick-radio" aria-hidden="true"></span>` +
    `${avatarHtml(c)}<div class="cand-info">` +
    `<div class="cand-name">${esc(c.name)} ${pills.join(' ')}</div>` +
    `<div class="cand-sub">${esc(c.summary || shortBio(c))}</div>` +
    `<button class="cand-details" type="button" data-open-cand="${esc(c.id)}">Details ↗</button>` +
    `</div></div>`;
  return td;
}
function shortBio(c) {
  if (!c.bio) return '';
  const s = c.bio.split(/(?<=[.!?])\s/)[0];
  return s.length > 96 ? s.slice(0, 93) + '…' : s;
}

function issueCell(c, k) {
  const p = (c.positions || {})[k];
  if (!p) { const td = el('td', 'cell empty'); td.innerHTML = '<span class="dash">—</span>'; return td; }
  const hasVid = !!p.videoUrl;
  const iss = DATA.issues[k];
  const td = el('td', 'cell' + (hasVid ? ' has-video' : ''));
  td.dataset.cand = c.id; td.dataset.issue = k;
  td.dataset.label = `${iss.icon} ${iss.label}`;
  td.innerHTML = `<span class="cell-dot" aria-hidden="true"></span>` +
    `<div class="cell-stance">${esc(p.stance)}</div>` +
    `<div class="cell-flag">${hasVid ? '▶ video clip' : 'source ↗'}</div>`;
  return td;
}

/* ---------- Tooltip ---------- */
function showTip(cell) {
  const c = DATA.candidates.find(x => x.id === cell.dataset.cand);
  const k = cell.dataset.issue; const p = c.positions[k]; const iss = DATA.issues[k];
  const tip = $('#tooltip');
  tip.innerHTML = `<div class="tt-issue">${iss.icon} ${esc(iss.label)}</div><div>${esc(p.stance)}</div>` +
    (p.quote ? `<div class="tt-quote">“${esc(p.quote)}”</div>` : '') +
    `<div class="tt-hint">Click for source${p.videoUrl ? ' + video clip ▶' : ''}</div>`;
  tip.hidden = false;
}
function moveTip(e) {
  const tip = $('#tooltip'); if (tip.hidden) return;
  const pad = 14; let x = e.clientX + pad, y = e.clientY + pad;
  const r = tip.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function hideTip() { $('#tooltip').hidden = true; }

/* ---------- Drawer ---------- */
function openDrawer(candId, focusIssue) {
  const c = DATA.candidates.find(x => x.id === candId); if (!c) return;
  const race = DATA.races.find(r => r.id === c.raceId);
  const body = $('#drawerBody');
  const links = []; const seenUrls = new Set();
  const addLink = (url, label, cls) => {
    if (!url || seenUrls.has(url)) return; seenUrls.add(url);
    links.push(`<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label} ↗</a>`);
  };
  if (c.website) addLink(c.website, 'Campaign site', '');
  (c.sources || []).forEach(s => addLink(s.url, esc(s.label), ''));
  (c.youtubeInterviews || []).forEach(v => addLink(v.url, '▶ ' + esc(v.channel || 'Video'), 'vid'));

  const issueKeys = Object.keys(DATA.issues).filter(k => c.positions && c.positions[k]);
  let posHtml = '';
  if (issueKeys.length === 0) {
    posHtml = '<p class="pos-empty">No sourced positions were found for this candidate before publication. This is left blank rather than guessed.</p>';
  } else {
    posHtml = issueKeys.map(k => positionBlock(c, k, k === focusIssue)).join('');
  }

  body.innerHTML =
    `<div class="d-head">${avatarHtml(c, 'avatar--lg')}<div>` +
    `<p class="d-office">${esc(race ? race.title : '')}${race && race.type === 'partisan' ? ' · ' + esc(c.party) : ''}${c.incumbent ? ' · Incumbent' : ''}</p>` +
    `<h2 id="drawerName">${esc(c.name)}</h2>` +
    (c.summary ? `<p class="d-summary">${esc(c.summary)}</p>` : '') +
    `</div></div>` +
    (c.bio ? `<p class="d-bio">${esc(c.bio)}</p>` : '') +
    (links.length ? `<div class="d-links">${links.join('')}</div>` : '') +
    posHtml;

  $('#drawer').hidden = false; $('#backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  if (focusIssue) { const t = body.querySelector(`[data-pos="${focusIssue}"]`); if (t) t.scrollIntoView({ block: 'center' }); }
}
function positionBlock(c, k, focus) {
  const p = c.positions[k]; const iss = DATA.issues[k];
  const cites = [];
  if (p.citationUrl) cites.push(`<a href="${esc(p.citationUrl)}" target="_blank" rel="noopener">Source ↗</a>`);
  if (p.videoUrl) cites.push(`<a class="vidlink" href="${esc(ytLink(p.videoUrl, p.timestamp))}" target="_blank" rel="noopener">▶ Watch clip${p.timestamp != null ? ' (@' + fmtTs(p.timestamp) + ')' : ''} ↗</a>`);
  const quote = p.quote || p.videoQuote;
  return `<div class="pos-block" data-pos="${esc(k)}" style="${focus ? 'background:#fbf4e3;border-radius:8px;padding-left:10px;padding-right:10px' : ''}">` +
    `<div class="pos-issue"><span class="ic">${iss.icon}</span> ${esc(iss.label)}</div>` +
    `<p class="pos-stance">${esc(p.stance)}</p>` +
    (quote ? `<p class="pos-quote">“${esc(quote)}”</p>` : '') +
    (cites.length ? `<div class="pos-cite">${cites.join('')}</div>` : '') +
    `</div>`;
}
function fmtTs(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function closeDrawer() { $('#drawer').hidden = true; $('#backdrop').hidden = true; document.body.style.overflow = ''; }

/* ---------- Methodology ---------- */
function openMethod() {
  $('#methodBody').innerHTML = `
    <p>${esc(DATA.meta.disclaimer)}</p>
    <h3>How positions were sourced</h3>
    <p>Every position links to its source. Where reporting and candidate materials did not yield a clear, citable stance on an issue, the cell is left <em>blank</em> — we do not infer or guess positions.</p>
    <ul>
      <li><strong>Written sources:</strong> candidate websites & “issues” pages, Ballotpedia candidate surveys, the Reno Gazette-Journal questionnaire, the Barber Brief, This Is Reno, mynews4 “Know Your Candidates,” KOLO 8, The Nevada Independent, and official filings from the Nevada Secretary of State, Washoe County, and the Cities of Reno & Sparks.</li>
      <li><strong>Video clips (▶):</strong> verbatim quotes pulled from YouTube transcripts of candidate forums and interviews — including the League of Women Voters Sparks mayoral forum — with deep-links to the exact timestamp. Speakers were only attributed where the recording made the speaker unambiguous.</li>
    </ul>
    <h3>The party filter</h3>
    <p>${esc(DATA.meta.primaryRules)}</p>
    <h3>Caveats</h3>
    <p>This is a snapshot built shortly before Election Day. Candidates evolve their positions; some withdrew but remain on printed ballots. Down-ballot and minor candidates have thinner coverage. Always confirm your specific ballot and registration at <a href="https://www.washoecounty.gov/voters" target="_blank" rel="noopener">washoecounty.gov/voters</a>.</p>
    <p style="font-size:12.5px;color:#8a8a94">Non-endorsing. No candidate or party reviewed or funded this guide. Corrections welcome via the repository.</p>`;
  $('#methodModal').hidden = false;
}

init();
