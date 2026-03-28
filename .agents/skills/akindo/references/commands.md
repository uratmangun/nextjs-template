# Akindo skill script commands

Run commands from repository root.

Use any TypeScript runner available in your environment. Examples below use `pnpm dlx tsx` with bundled scripts in `.agents/skills/akindo/scripts/`.

## 1) List wave-hacks

Script: `.agents/skills/akindo/scripts/fetch-akindo-wave-hacks.ts`

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-wave-hacks.ts --page 1 --page-size 12
```

Raw JSON:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-wave-hacks.ts --page 1 --page-size 12 --raw
```

## 2) Fetch wave timeline (wave-hack detail context)

Script: `.agents/skills/akindo/scripts/fetch-akindo-wave-timeline.ts`

By flag:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-wave-timeline.ts --wave-hack-id <waveHackId> --page 1 --page-size 5
```

By positional ID:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-wave-timeline.ts <waveHackId> --page 1 --page-size 5
```

By environment variable:

```bash
AKINDO_WAVE_HACK_ID=<waveHackId> pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-wave-timeline.ts --page 1 --page-size 5
```

Raw JSON:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-wave-timeline.ts <waveHackId> --page 1 --page-size 5 --raw
```

## 3) Fetch submissions

Script: `.agents/skills/akindo/scripts/fetch-akindo-submissions.ts`

By flag:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submissions.ts --wave-hack-id <waveHackId> --page 1 --page-size 10
```

By positional ID:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submissions.ts <waveHackId> --page 1 --page-size 10
```

By environment variable:

```bash
AKINDO_WAVE_HACK_ID=<waveHackId> pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submissions.ts --page 1 --page-size 10
```

Raw JSON:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submissions.ts <waveHackId> --page 1 --page-size 10 --raw
```

## 4) Check submission insights (grant totals, hidden/public, GitHub links, YouTube links)

Script: `.agents/skills/akindo/scripts/fetch-akindo-submission-insights.ts`

By flag:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submission-insights.ts --wave-hack-id <waveHackId> --page 1 --page-size 5
```

By positional ID:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submission-insights.ts <waveHackId> --page 1 --page-size 5
```

By environment variable:

```bash
AKINDO_WAVE_HACK_ID=<waveHackId> pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submission-insights.ts --page 1 --page-size 5
```

Include per-submission rows (visibility + GitHub + earned amount):

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submission-insights.ts <waveHackId> --page 1 --page-size 2 --show-submissions
```

Raw JSON:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submission-insights.ts <waveHackId> --page 1 --page-size 5 --raw
```

### Field guide for insights output

- `waveGrantAmount`: grant pool amount for that wave
- `earnedAmount`: per-submission earned amount (actual grant result)
- `isHidden`: derived from product visibility (`true` means hidden)
- `publicWithGithub`: count of public submissions with `githubRepositoryName`
- `publicWithDeliverableUrl`: count of public submissions with `deliverableUrl`
- `publicWithYoutube`: count of public submissions with extracted YouTube links
- `videoUrl`: product-level video URL from `GET /public/communities/{communityId}/products/{productId}` when available
- `youtube`: per-submission extracted YouTube URLs (primary source: product `videoUrl`; fallback: full submission payload)

## 5) Differentiate project description vs wave update

Project-level description and wave-level update come from different fields:

- **Project description** (stable, product-level):
  - `GET /public/communities/{communityId}/products/{productId}` → `description`
- **Wave update** (changes each wave):
  - `GET /public/wave-hacks/{waveHackId}/waves/{waveId}/submissions` → each `submission.comment` (and `submission.planComment` when present)

Quick rule:

- Use `product.description` for the “Description” column
- Use `submission.comment` for the “Wave update” column

## 6) Extract YouTube links via public Akindo API

Primary source: `GET /public/communities/{communityId}/products/{productId}` and read `videoUrl`.

Fallback source: extract URL-like strings from each submission payload and filter by `youtube.com`/`youtu.be`.

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submission-insights.ts <waveHackId> --page 1 --page-size 5 --show-submissions
```

or:

```bash
pnpm dlx tsx .agents/skills/akindo/scripts/fetch-akindo-submissions.ts <waveHackId> --page 1 --page-size 10
```

Then inspect `youtube` output per submission. If output is `N/A`, no YouTube URL was found in the public submission payload.

## Notes

- `--page-size` is capped at `50` in all scripts.
- `fetch-akindo-submissions.ts` paginates by wave page, then fetches submissions for waves in that page.
- `fetch-akindo-submission-insights.ts` computes visibility, GitHub coverage, and YouTube-link coverage per wave.
- Suggested flow:
  1. List wave-hacks and pick `waveHackId`
  2. Inspect timeline for context
  3. Fetch submissions for the same `waveHackId`
  4. Run submission insights for grant + hidden/public + GitHub checks
