# at.store

A TanStack Start + React web app for the AT Protocol app store / directory, backed by Postgres (Drizzle ORM) and ATProto OAuth.

## Getting started

### Prerequisites

- **Node.js 20+** (22 LTS recommended)
- **pnpm** — install with `corepack enable` or `npm i -g pnpm`
- Optional: [`goat`](https://github.com/bluesky-social/goat) — only needed if you plan to publish/lint ATProto lexicons (`brew install goat`)

### Clone and install

```bash
git clone https://github.com/<your-fork>/at-store.git
cd at-store
pnpm install
```

## Common scripts

```bash
pnpm dev              # Vite dev server on :3000
pnpm build            # Production build
pnpm start            # Run the built server
pnpm test             # Vitest

pnpm db:generate      # Generate a new Drizzle migration from schema changes
pnpm db:migrate       # Apply pending migrations
pnpm db:studio        # Drizzle Studio
pnpm db:backup        # pg_dump → ./backups (override with DB_BACKUP_DIR)

pnpm lex:gen          # Regenerate the lexicon bundle from ./lexicons
pnpm lex:lint         # Lint lexicons via goat
pnpm atproto:publish-lexicons  # Publish lexicons to the configured repo
```

Background consumers (optional, run in separate terminals):

```bash
pnpm tap:consumer         # Ingest fyi.atstore.listing.* records into Postgres
pnpm jetstream:consumer   # Track Bluesky post mentions → trending scores
```

See `package.json` for the full list of `generate:*`, `backfill:*`, and `scrape:*` scripts.

## Project layout

- `src/routes/` — TanStack Router file-based routes (including `_admin-layout` / `_header-layout` segments)
- `src/db/` — Drizzle schema and queries
- `src/integrations/` — ATProto OAuth, TanStack Query, external APIs
- `src/design-system/` — Shared UI primitives (autocomplete, popovers, theme)
- `lexicons/` — ATProto lexicons under `fyi.atstore.*`
- `drizzle/` — Generated SQL migrations
- `scripts/` — One-off and recurring CLI scripts (scraping, generation, consumers)
