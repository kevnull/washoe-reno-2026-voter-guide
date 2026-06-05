import { readFileSync, writeFileSync } from 'node:fs';
const base = './data/candidates.json';
const data = JSON.parse(readFileSync(base, 'utf8'));
const patches = JSON.parse(readFileSync('./research/video-quotes.json', 'utf8'));
const byId = new Map(data.candidates.map(c => [c.id, c]));

let added = 0, enriched = 0, skipped = 0;
const seen = new Set();
for (const p of patches) {
  const key = `${p.candidateId}::${p.issueKey}`;
  if (seen.has(key)) { skipped++; continue; }   // first quote per (candidate,issue) wins
  seen.add(key);
  const c = byId.get(p.candidateId);
  if (!c) { console.warn('no candidate', p.candidateId); skipped++; continue; }
  c.positions ||= {};
  const existing = c.positions[p.issueKey];
  if (existing) {
    // enrich existing text-sourced position with a video clip (don't clobber its citation)
    existing.videoUrl = p.videoUrl;
    existing.timestamp = p.timestamp;
    if (!existing.quote) existing.quote = p.quote;
    existing.videoQuote = p.quote;
    enriched++;
  } else {
    c.positions[p.issueKey] = {
      stance: p.stance,
      quote: p.quote,
      citationUrl: p.videoUrl,
      videoUrl: p.videoUrl,
      timestamp: p.timestamp,
    };
    added++;
  }
}
writeFileSync(base, JSON.stringify(data, null, 2));
console.log(`Video merge: ${added} new positions, ${enriched} enriched, ${skipped} skipped(dupe/missing).`);
const withVideo = data.candidates.filter(c => Object.values(c.positions || {}).some(p => p.videoUrl)).length;
console.log(`Candidates with >=1 video-linked position: ${withVideo}`);
