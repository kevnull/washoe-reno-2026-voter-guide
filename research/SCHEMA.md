# Candidate data schema (June 9, 2026 Washoe/Reno primary voter guide)

Each research agent writes ONE file: `research/<cluster>.json` with this shape:

```json
{
  "races": [
    {
      "id": "reno-mayor",
      "title": "Reno Mayor",
      "jurisdiction": "Reno",
      "type": "nonpartisan",            // "nonpartisan" | "partisan"
      "tier": "marquee",                // "marquee" | "standard"
      "seats": 1,
      "notes": "Top-two advance to Nov general. Open to ALL voters."
    }
  ],
  "candidates": [
    {
      "id": "devon-reese",
      "name": "Devon Reese",
      "raceId": "reno-mayor",
      "party": "Nonpartisan",          // For partisan races: "Democratic"|"Republican"|"Nonpartisan"|"Libertarian"|"Independent American" etc.
      "incumbent": false,
      "bio": "1-2 sentence factual bio with current role.",
      "website": "https://...",        // official campaign site or null
      "sources": [
        { "label": "RGJ candidate questionnaire", "url": "https://..." }
      ],
      "youtubeInterviews": [
        { "title": "KOLO Meet the Candidates", "url": "https://youtube.com/watch?v=...", "channel": "KOLO" }
      ],
      "positions": {
        "budget": {
          "stance": "Short neutral summary of their position (<=160 chars).",
          "quote": "Exact verbatim quote if available, else null.",
          "citationUrl": "https://...",   // URL supporting this position
          "videoUrl": null,                // YouTube URL if quote is from video
          "timestamp": null                // seconds (int) into the video, if known
        }
      }
    }
  ]
}
```

## INTEGRITY RULES (non-negotiable — this is a real voter guide)
1. NEVER invent a position. If you cannot find a sourced stance on an issue, OMIT that issue key for that candidate (do not fabricate).
2. Every `positions` entry MUST have a real `citationUrl` that actually supports the stance.
3. `quote` must be verbatim from the source. If paraphrasing, set `quote` to null and only fill `stance`.
4. Prefer primary sources: candidate sites, official questionnaires (RGJ, Barber Brief, This Is Reno, mynews4 "Know Your Candidates", KOLO), Ballotpedia candidate surveys.
5. If a whole candidate has no findable positions, still include them with bio + sources + empty `positions: {}`.

## Canonical issue keys (use these where applicable; add race-specific ones as needed)
- `budget` — municipal/county fiscal health, deficits, spending
- `dataCenters` — data center development, water/power use, tax abatements
- `housing` — housing affordability, supply, zoning
- `homelessness` — homeless services, Cares Campus, encampments
- `growth` — growth/development, sprawl, infrastructure
- `water` — water resources, drought, allocation
- `publicSafety` — policing, crime, staffing
- `taxes` — tax policy, abatements, fees
- `education` — schools, WCSD, funding
- `transparency` — govt transparency, ethics, accountability
- `abortion` — reproductive rights (state/federal races)
- `immigration` — immigration (federal races)
- `economy` — jobs, economic development (federal/state)
- `electionIntegrity` — election administration/integrity (where relevant)
```
