# Next.js Template

A minimal Next.js 16 template that deploys to Cloudflare Workers with `@opennextjs/cloudflare` and Wrangler.

Live demo: https://nextjs-template.gule.workers.dev

## What’s included

- Next.js App Router app
- Cloudflare Workers deployment via OpenNext
- Local Workers preview with Wrangler
- Browser-configured OpenAI-compatible chat settings
- Server-side base URL hardening for public template safety
- Static asset caching via `public/_headers`

## Template behavior

This template keeps provider configuration in the browser:

- `baseURL` is stored in `localStorage`
- `apiKey` is stored in `localStorage`
- available models are loaded from `POST /api/models`
- chat streaming is proxied through `POST /api/chat`

Because this repository is meant to be public and reusable, the server validates the configured provider URL before proxying requests.

Allowed provider URLs must:

- use `https`
- point to a public host
- not target `localhost` or private network IPs
- not include embedded credentials
- not include query strings or hash fragments

Example valid base URL:

```text
https://api.openai.com/v1
```

## Prerequisites

- Node.js 20+
- `pnpm`
- Cloudflare account
- Wrangler authenticated with your Cloudflare account

## Install

```bash
pnpm install
```

## Local development

Run standard Next.js development:

```bash
pnpm dev
```

Run a Cloudflare Workers preview using the OpenNext adapter:

```bash
pnpm preview
```

The Workers preview reads `.dev.vars`.

Create it from the example if needed:

```bash
cp .dev.vars.example .dev.vars
```

Current example contents:

```text
NEXTJS_ENV=development
```

## Deploy to Cloudflare Workers

This project is already configured for Workers in `wrangler.jsonc` and `open-next.config.ts`.

Deploy with:

```bash
pnpm run deploy
```

Useful related commands:

```bash
pnpm run upload
pnpm run cf-typegen
```

## Worker configuration

The deployed Worker uses:

- service name: `nextjs-template`
- default domain: `https://nextjs-template.gule.workers.dev`
- compatibility flags:
  - `nodejs_compat`
  - `global_fetch_strictly_public`

Static assets are served from `.open-next/assets`, and `_next/static` assets are cached aggressively through `public/_headers`.

## Project files

- `app/page.tsx` — chat UI and browser-side provider settings
- `app/api/models/route.ts` — loads models from an OpenAI-compatible `/models` endpoint
- `app/api/chat/route.ts` — streams chat completions from an OpenAI-compatible `/chat/completions` endpoint
- `lib/provider-url.ts` — validates public HTTPS provider URLs
- `wrangler.jsonc` — Cloudflare Worker configuration
- `open-next.config.ts` — OpenNext Cloudflare adapter config

## Notes for template users

If you create a new repository from this template, you will usually want to update:

- the Worker name in `wrangler.jsonc`
- the GitHub repository homepage URL
- the app metadata and branding

After renaming the Worker, redeploy with Wrangler to get your own `*.workers.dev` URL.
