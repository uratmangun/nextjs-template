---
name: akindo
description: Fetch Akindo wave-hack data with bundled scripts. Use when users ask to list wave-hacks, inspect wave timeline/detail context, retrieve submissions, or analyze grant/hidden/github/youtube insights by wave-hack id.
---

# Akindo

Use this skill to run and explain Akindo data-fetch scripts in this repository.

## Workflow

1. Confirm which dataset the user needs:
   - wave-hacks list
   - wave timeline/detail context
   - wave submissions
   - submission insights (grant totals, hidden/public status, GitHub links, YouTube links)
2. Run the matching script from project root.
3. Prefer paginated requests (`--page`, `--page-size`) unless user asks for raw payload.
4. Use `--raw` when user wants machine-readable JSON.
5. For submissions/timeline/insights, resolve `waveHackId` via:
   - `--wave-hack-id <id>`
   - positional `<id>`
   - `AKINDO_WAVE_HACK_ID`
6. For grant + visibility checks:
   - wave-level grant total: `waveGrantAmount`
   - submission-level grant result: `earnedAmount`
   - hidden status: `isHidden` (derived from `product.isPublic`)
   - GitHub repo (when public): `githubRepositoryName`
7. For link extraction checks:
   - primary source for product demo video: `GET /public/communities/{communityId}/products/{productId}` → `videoUrl`
   - fallback source: parse URL-like strings from the full submission payload
   - YouTube link detection: URLs containing `youtube.com` or `youtu.be`
   - per-submission links in scripts: `links.youtube`
8. For description vs wave-update checks:
   - product description source: product detail endpoint `GET /public/communities/{communityId}/products/{productId}` → `description`
   - wave update source: submission payload `comment` (and optionally `planComment`)
   - `description` is product-level and reused across waves for the same product
   - `comment`/`planComment` are wave-specific progress updates
   - if product `description` is missing, use product `tagline` as fallback summary
9. For point + rating checks:
   - do not rely on `submission.point` (usually `null`)
   - total score is in `votes[].point`
   - per-criterion ratings are in `votes[].criterionRatings[]`
   - criterion name: `votes[].criterionRatings[].criterion.title`
   - criterion value: `votes[].criterionRatings[].value`
   - point/rating data can be present for both hidden and non-hidden submissions

## Script map

- Wave-hacks list: `.agents/skills/akindo/scripts/fetch-akindo-wave-hacks.ts`
- Wave timeline/detail context: `.agents/skills/akindo/scripts/fetch-akindo-wave-timeline.ts`
- Wave submissions: `.agents/skills/akindo/scripts/fetch-akindo-submissions.ts`
- Submission insights (grant/hidden/github/youtube): `.agents/skills/akindo/scripts/fetch-akindo-submission-insights.ts`

## YouTube link retrieval notes

- Product detail endpoint `GET /public/communities/{communityId}/products/{productId}` can expose `videoUrl` (often YouTube).
- Wave submission payload product objects often omit `videoUrl`, so enrich from product-detail endpoint when needed.
- As fallback, YouTube links can appear inside text fields (typically `comment`/`planComment`) in submission payloads.
- Filter URLs by `youtube.com` or `youtu.be`.
- Product pages can load YouTube resources for embeds/analytics; do not treat those network calls as proof of a user-submitted demo link.

Read command examples in `references/commands.md`.
