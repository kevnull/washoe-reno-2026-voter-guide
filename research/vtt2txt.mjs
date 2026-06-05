// Convert WebVTT auto-captions to clean timestamped text.
// De-dupes YouTube's rolling-caption repetition. Output: "[mm:ss] text" lines.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const raw = readFileSync(file, 'utf8');
const lines = raw.split('\n');
const tsRe = /(\d{2}):(\d{2}):(\d{2})\.\d{3}\s+-->/;
let segs = [];
let curT = null;
for (let line of lines) {
  const m = line.match(tsRe);
  if (m) { curT = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]); continue; }
  if (curT === null) continue;
  // strip inline timing tags <00:00:00.000> and <c> tags
  let text = line.replace(/<[^>]+>/g, '').trim();
  if (!text) continue;
  segs.push({ t: curT, text });
}
// de-dupe consecutive identical / contained lines
let out = [];
let lastText = '';
for (const s of segs) {
  if (s.text === lastText) continue;
  if (lastText && lastText.endsWith(s.text)) continue;
  out.push(s);
  lastText = s.text;
}
// merge into ~15s buckets for readability
let merged = [];
let bucket = null;
for (const s of out) {
  if (!bucket || s.t - bucket.t >= 15) {
    if (bucket) merged.push(bucket);
    bucket = { t: s.t, text: s.text };
  } else {
    bucket.text += ' ' + s.text;
  }
}
if (bucket) merged.push(bucket);
const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
const txt = merged.map(b => `[${fmt(b.t)}] ${b.text}`).join('\n');
const outFile = file.replace(/\.en\.vtt$/, '.txt');
writeFileSync(outFile, txt);
console.log(`${outFile}: ${merged.length} segments, ${txt.length} chars`);
