# CandyElo

ELO-Ranking-Webapp für deutsche Süßigkeiten.
Stack: **Next.js 16 (App Router) · Tailwind 4 · shadcn/ui · Framer Motion · Supabase · Upstash · Cloudflare Turnstile**.

## Setup

```bash
pnpm install
cp .env.local.example .env.local   # or hand-fill — see below
```

### 1. Apply the Supabase schema

The schema lives in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
Easiest: paste it once into the Supabase SQL editor:

```
https://supabase.com/dashboard/project/nnjpassejnvvpiphcpec/sql/new
```

Or, if you have a Supabase Personal Access Token:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_…
pnpm db:apply
```

### 2. Seed candies

```bash
pnpm seed:fetch    # pulls Open Food Facts data → scripts/candies.cache.json
pnpm seed:push     # uploads cache to Supabase
```

`seed:fetch` is idempotent — re-running only refetches misses. Only OFF data
makes it into the DB: `seed:push` filters out anything whose `image_url`
isn't from `*.openfoodfacts.org` (so Wikipedia / Commons fallbacks stay in
the cache for reference but never appear on the live site). To add a candy
that OFF doesn't surface via search, look up its EAN-13 on
`world.openfoodfacts.org/product/<barcode>` and add the `barcode` field to
its entry in `scripts/candy-list.ts`; barcode lookups bypass the strict
brand+name matcher.

`pnpm seed:wiki` exists but is **opt-in only** — it pulls Wikipedia /
Commons images, but those are not pushed to Supabase by `seed:push`. Use it
if you ever want to switch the policy back to "Wikipedia as fallback".

### 3. Run

```bash
pnpm dev
```

→ http://localhost:3000

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | `sb_publishable_…` (was anon key) |
| `SUPABASE_SECRET_KEY` | yes | `sb_secret_…` (server only) |
| `PAIR_TOKEN_SECRET` | yes | random 32+ chars; signs vote pair tokens |
| `IP_HASH_PEPPER` | yes | random 16+ chars; salts IP hashes |
| `UPSTASH_REDIS_REST_URL` | prod | Upstash Redis (rate-limit). Falls back to in-memory in dev. |
| `UPSTASH_REDIS_REST_TOKEN` | prod | |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | prod | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | prod | Cloudflare Turnstile secret |

If Turnstile vars are absent, the gate auto-passes (dev mode). If Upstash is absent, an in-process limiter is used (dev only — does not survive restarts).

## Anti-fraud

- HMAC-signed pair tokens (5 min TTL); the server hands them out from `/api/pair`, the client returns them with the vote.
- 100 votes / 24h per IP (rolling window, Upstash).
- Min 800ms between two votes from the same IP (bot filter).
- Cloudflare Turnstile on first vote-page visit; cookie suppresses re-challenges for 24h.
- IPs are stored as truncated SHA-256(`pepper + ip`) — never as raw IPs.

## ELO

K = 32, transactional update inside the `cast_vote` Postgres function (SECURITY DEFINER, locks both rows in deterministic id order to avoid deadlocks).

## Project layout

```
src/
  app/
    api/{pair,vote,turnstile}/route.ts   server endpoints
    vote/                                vote screen
    leaderboard/                         realtime leaderboard
  components/
    candy/CandyCard.tsx                  voting card
    candy/TurnstileGate.tsx              first-visit challenge
    ui/…                                 shadcn primitives
  lib/
    elo/                                 ELO math (used by tests / SQL mirrors)
    security/                            pair-token, rate-limit, identity, turnstile
    supabase/                            client + types
scripts/
  candy-list.ts                          curated seed list
  fetch-off.ts                           OFF fetcher (pnpm seed:fetch)
  seed-supabase.ts                       upsert into Supabase (pnpm seed:push)
  apply-sql.ts                           apply migrations (pnpm db:apply)
supabase/migrations/                     SQL migrations
```

## Deploy

`vercel --prod` once env vars are set on the project.
