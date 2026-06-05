# Washoe County & Reno — June 9, 2026 Primary Voter Guide

An independent, **non-endorsing**, fully-cited interactive guide to every race on the June 9, 2026 Nevada primary ballot in Washoe County, Reno, and Sparks.

🔗 **Live site:** _(GitHub Pages URL — see Settings → Pages)_

## What it does
- **Every race on the Washoe ballot** — Federal (NV-2 U.S. House), statewide (Governor, AG, SoS, Treasurer, Controller, Lt. Gov.), the Nevada Legislature, Washoe County offices, and the cities of Reno and Sparks. **36 races, 104 candidates.**
- **Issue grid** — each candidate's positions across up to 14 issues (budget, data centers, housing, homelessness, growth, water, public safety, taxes, education, transparency, election integrity, economy, reproductive rights, immigration).
- **Filter by your registered party** — models Nevada's *closed* primary: Republicans and Democrats see only their own partisan primaries plus all nonpartisan races; nonpartisan/independent voters see nonpartisan races only (partisan races are shown but dimmed as "not on your ballot").
- **Sourced everything** — click any cell for the candidate's stance, a verbatim quote, a link to the source, and where available a **deep-linked YouTube clip** jumping to the exact timestamp.
- **Hover** any cell for a quick quote tooltip; **click a name** for the full candidate dossier.

## Integrity rule
Where no clearly citable position was found for a candidate on an issue, the cell is left **blank** — positions are never inferred or invented. The dataset is open and auditable in [`data/candidates.json`](data/candidates.json).

## Sources
Candidate websites & "issues" pages, Ballotpedia, the Reno Gazette-Journal questionnaire, the Barber Brief, This Is Reno, mynews4 "Know Your Candidates," KOLO 8, The Nevada Independent, official filings (Nevada Secretary of State, Washoe County, Cities of Reno & Sparks), and YouTube transcripts of candidate forums/interviews (incl. the League of Women Voters Sparks mayoral forum) mined for verbatim, timestamped quotes.

## How it's built
Zero-build static site — plain HTML/CSS/vanilla JS, no framework or bundler — so it deploys to GitHub Pages with no CI and loads instantly. Data lives in `data/candidates.json`; the research/merge pipeline is in [`research/`](research/).

```
.
├── index.html
├── css/styles.css
├── js/app.js
├── data/candidates.json      ← the dataset (open, auditable)
└── research/                 ← raw per-cluster JSON, transcripts, merge scripts
```

## Disclaimer
This is a volunteer snapshot built shortly before Election Day. Candidates evolve their positions; some withdrew but remain on printed ballots. **Always confirm your specific ballot and registration at [washoecounty.gov/voters](https://www.washoecounty.gov/voters).** Corrections welcome via issues/PRs.
