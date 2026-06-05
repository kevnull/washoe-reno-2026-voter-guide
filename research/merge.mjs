import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter(f => f.endsWith('.json'));

const ISSUES = {
  budget:           { label: 'Budget & Fiscal',        icon: '💰', desc: 'Municipal/county/state fiscal health, deficits, spending priorities.' },
  taxes:            { label: 'Taxes & Fees',           icon: '🧾', desc: 'Tax policy, fees, abatements.' },
  dataCenters:      { label: 'Data Centers',           icon: '🖥️', desc: 'Data-center development, water/power use, tax abatements.' },
  housing:          { label: 'Housing',                icon: '🏠', desc: 'Housing affordability, supply, zoning.' },
  homelessness:     { label: 'Homelessness',           icon: '🤝', desc: 'Homeless services, Cares Campus, encampments.' },
  growth:           { label: 'Growth & Development',   icon: '🏗️', desc: 'Growth, sprawl, infrastructure, land use.' },
  water:            { label: 'Water',                  icon: '💧', desc: 'Water resources, drought, allocation.' },
  publicSafety:     { label: 'Public Safety',          icon: '🚓', desc: 'Policing, crime, first-responder staffing.' },
  education:        { label: 'Education',              icon: '🎓', desc: 'Schools, WCSD, funding.' },
  transparency:     { label: 'Transparency & Ethics',  icon: '🔎', desc: 'Government transparency, ethics, accountability.' },
  electionIntegrity:{ label: 'Election Integrity',     icon: '🗳️', desc: 'Election administration and integrity.' },
  economy:          { label: 'Economy & Jobs',         icon: '📈', desc: 'Jobs, cost of living, economic development.' },
  abortion:         { label: 'Reproductive Rights',    icon: '⚕️', desc: 'Abortion / reproductive rights.' },
  immigration:      { label: 'Immigration',            icon: '🌎', desc: 'Immigration policy (federal races).' },
};
const ISSUE_ORDER = Object.keys(ISSUES);

let races = [];
let candidates = [];
for (const f of files) {
  const data = JSON.parse(readFileSync(join(here, f), 'utf8'));
  if (data.races) races.push(...data.races.map(r => ({ ...r, _src: f })));
  if (data.candidates) candidates.push(...data.candidates.map(c => ({ ...c, _src: f })));
}

// --- Dedupe WCSD District F: keep canonical race id "wcsd-board-f", drop the sparks duplicate ---
const DUP = 'wcsd-trustee-district-f';
const CANON = 'wcsd-board-f';
// adopt the richer Sparks note onto the canonical race
const dupRace = races.find(r => r.id === DUP);
const canonRace = races.find(r => r.id === CANON);
if (dupRace && canonRace && dupRace.notes) canonRace.notes = dupRace.notes;
races = races.filter(r => r.id !== DUP);
candidates = candidates.filter(c => c.raceId !== DUP);

// --- Validate: every candidate references an existing race ---
const raceIds = new Set(races.map(r => r.id));
const orphans = candidates.filter(c => !raceIds.has(c.raceId));
if (orphans.length) {
  console.error('ORPHAN candidates (no matching race):');
  orphans.forEach(c => console.error(`  ${c.name} -> ${c.raceId} (${c._src})`));
  process.exit(1);
}

// --- Validate: every position has a citation; strip & warn on any that don't ---
let stripped = 0;
for (const c of candidates) {
  for (const [k, p] of Object.entries(c.positions || {})) {
    if (!p || !p.citationUrl) {
      console.warn(`STRIP no-citation position: ${c.name} / ${k} (${c._src})`);
      delete c.positions[k];
      stripped++;
    }
  }
}

// --- Jurisdiction + level grouping for UI ordering ---
const LEVEL = { Federal: 0, Statewide: 1, 'State Legislature': 2, Washoe: 3, Reno: 4, Sparks: 5 };
function levelOf(r) {
  const j = (r.jurisdiction || '').toLowerCase();
  if (j.includes('federal')) return 'Federal';
  if (r.id.startsWith('nv-assembly') || r.id.startsWith('nv-senate')) return 'State Legislature';
  if (r.id.startsWith('nv-')) return 'Statewide';
  if (j.includes('reno')) return 'Reno';
  if (j.includes('spark')) return 'Sparks';
  return 'Washoe';
}
races = races.map(r => ({ ...r, level: levelOf(r) }));
races.sort((a, b) => (LEVEL[a.level] - LEVEL[b.level])
  || (b.tier === 'marquee') - (a.tier === 'marquee')
  || a.title.localeCompare(b.title));

// clean internal fields
races.forEach(r => delete r._src);
candidates.forEach(c => delete c._src);

// --- Only keep issues actually used, in canonical order ---
const used = new Set();
candidates.forEach(c => Object.keys(c.positions || {}).forEach(k => used.add(k)));
const issues = {};
ISSUE_ORDER.filter(k => used.has(k)).forEach(k => { issues[k] = ISSUES[k]; });
const unknown = [...used].filter(k => !ISSUES[k]);
if (unknown.length) console.warn('Unknown issue keys (add to dict):', unknown);

const out = {
  meta: {
    title: 'Washoe County & Reno — June 9, 2026 Primary Voter Guide',
    electionDate: '2026-06-09',
    earlyVoting: 'May 23 – June 5, 2026',
    jurisdictions: ['Federal (NV-2)', 'Nevada statewide', 'State Legislature', 'Washoe County', 'Reno', 'Sparks'],
    disclaimer: 'Independent, non-endorsing guide. Every position links to its source. Where no sourced stance was found, the cell is left blank rather than guessed. Verify your specific ballot at washoecounty.gov/voters.',
    primaryRules: 'Nevada runs a CLOSED partisan primary: registered Republicans and Democrats vote only their own party in partisan races (Governor, Congress, Legislature, partisan county offices). NONPARTISAN races (Reno/Sparks mayor & council, school board, judges) appear for EVERY voter, including nonpartisan/independent registrants.',
  },
  issues,
  races,
  candidates,
};

writeFileSync(join(here, '..', 'data', 'candidates.json'), JSON.stringify(out, null, 2));
console.log(`\nMerged: ${races.length} races, ${candidates.length} candidates, ${Object.keys(issues).length} issues. Stripped ${stripped} uncited positions.`);
console.log('Races by level:');
const byLevel = {};
races.forEach(r => { (byLevel[r.level] ||= []).push(r.id); });
for (const [lvl, ids] of Object.entries(byLevel)) console.log(`  ${lvl}: ${ids.length}`);
