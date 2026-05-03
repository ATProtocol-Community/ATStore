# at.store

A TanStack Start + React web app for the AT Protocol app store / directory, backed by Postgres (Drizzle ORM, pgvector) and ATProto OAuth.

---

## Quick start (TL;DR)

```bash
# 1. Install Postgres + pgvector once (macOS):
brew install postgresql@17 pgvector
brew services start postgresql@17
createdb at_store

# 2. Clone and bootstrap:
git clone https://github.com/<your-fork>/at-store.git
cd at-store
pnpm install
pnpm run setup        # copies .env, verifies Postgres, enables pgvector, runs migrations
pnpm dev          # http://127.0.0.1:3000
```

---

## Prerequisites

| Tool                                                              | Why                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| **Node.js 20+** (22 LTS recommended)                              | Runtime for Vite + scripts                                 |
| **pnpm 10+**                                                      | `corepack enable` or `npm i -g pnpm`                       |
| **Postgres 14+** with **pgvector**                                | App database (see [Install Postgres](#1-install-postgres)) |
| **`pg_dump` / `psql`** _(usually bundled with Postgres)_          | Used by `pnpm db:backup` and direct DB access              |
| **[`goat`](https://github.com/bluesky-social/goat)** _(optional)_ | Publish/lint ATProto lexicons (`brew install goat`)        |

---

## Local development

### 1. Install Postgres

You only need to do this once per machine.

**macOS (Homebrew)**

```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
createdb at_store
```

The default Homebrew install creates a superuser matching your macOS
username with no password, listening on `localhost:5432`. Update
`DATABASE_URL` in `.env` accordingly (see step 3).

**macOS (Postgres.app)**

1. Install [Postgres.app](https://postgresapp.com) and start it.
2. `brew install pgvector` (Postgres.app uses Homebrew's extension dir).
3. `createdb at_store`.

**Linux (Debian/Ubuntu)**

```bash
sudo apt install postgresql-17 postgresql-17-pgvector
sudo -u postgres createdb at_store
sudo -u postgres createuser -s $USER   # if you don't already have a role
```

`pnpm run setup` enables the `vector` extension automatically — you don't
need to run `CREATE EXTENSION` by hand.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Bootstrap your environment

```bash
pnpm run setup
```

This is idempotent and does the following:

1. Copies `.env.example` → `.env` (only if `.env` doesn't already exist).
2. Connects to `DATABASE_URL` and prints the Postgres version.
3. Runs `CREATE EXTENSION IF NOT EXISTS vector`.
4. Runs Drizzle migrations (`pnpm db:migrate`).
5. Seeds a handful of demo listings so the home page renders something
   immediately (`pnpm db:seed`).

If the connection or pgvector check fails, the script prints the exact
install command for your platform.

The default `DATABASE_URL` in `.env.example` is
`postgresql://postgres:postgres@localhost:5432/at_store`. If your local
Postgres uses a different user (e.g. your macOS username with no
password from Homebrew), edit `.env` to match — for example:

```
DATABASE_URL=postgresql://yourname@localhost:5432/at_store
```

### 4. Fill in `.env` (optional but recommended)

The app boots without any API keys, but most interesting features need at
least one of the following. Open `.env` and add what you have:

| Variable                                      | What it unlocks                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`                           | LLM-powered listing copy, taxonomy generation, discovery helpers                                                   |
| `ATSTORE_IDENTIFIER` + `ATSTORE_APP_PASSWORD` | Publishing listings to the @store ATProto repo, admin actions                                                      |
| `ATPROTO_BASE_URL`                            | OAuth redirect URI — defaults to `http://127.0.0.1:3000` (use `127.0.0.1`, **not** `localhost`, for ATProto OAuth) |
| `JETSTREAM_URL` / `TAP_URL`                   | Background ingestion consumers (see below)                                                                         |

`.env.example` documents every supported variable.

### 5. Start the dev server

```bash
pnpm dev          # http://127.0.0.1:3000
```

---

## Database scripts

```bash
pnpm db:migrate    # apply pending migrations
pnpm db:generate   # generate a new migration from schema changes
pnpm db:seed       # insert a handful of demo listings (idempotent, local-only)
pnpm db:studio     # browse data with Drizzle Studio
pnpm db:backup     # pg_dump → ./backups (override with DB_BACKUP_DIR)
```

`pnpm db:seed` refuses to run against any host other than `localhost` /
`127.0.0.1` unless `ALLOW_REMOTE_SEED=1` is set.

### Restoring from a backup

If you have a `pg_dump -Fc` file (e.g. from `pnpm db:backup` or a teammate):

```bash
pg_restore --clean --if-exists -d at_store path/to/file.dump
```

### Wiping your local database

```bash
dropdb at_store && createdb at_store && pnpm run setup
```

---

## Running services

The app is split into one frontend + a few optional background workers.
None of the workers are required to develop the UI — they only matter if
you want live ATProto data flowing into your local DB.

| Command                   | What it does                                                                                                                                                                                                        | Required for local UI? |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `pnpm dev`                | TanStack Start dev server on `:3000`                                                                                                                                                                                | **Yes**                |
| `pnpm tap:consumer`       | Ingests `fyi.atstore.listing.*`, `site.standard.publication`, and `site.standard.document` into Postgres (needs a [Tap](https://github.com/bluesky-social/indigo/tree/main/cmd/tap) server reachable via `TAP_URL`) | No                     |
| `pnpm jetstream:consumer` | Tracks Bluesky post mentions → trending scores                                                                                                                                                                      | No                     |

Each consumer is meant to run in its own terminal. They are restart-safe:
both keep cursor state in Postgres so you can stop and start them freely.

See `package.json` for the full list of `backfill:*`, DB, and consumer scripts.

---

## Project layout

- `src/routes/` — TanStack Router file-based routes (`_admin-layout` / `_header-layout` segments)
- `src/db/` — Drizzle schema, queries, and connection setup
- `src/integrations/` — ATProto OAuth, TanStack Query, external APIs
- `src/design-system/` — Shared UI primitives (autocomplete, popovers, theme)
- `lexicons/` — ATProto lexicons under `fyi.atstore.*`
- `drizzle/` — Generated SQL migrations (the source of truth — never edit by hand)
- `scripts/` — One-off and recurring CLI scripts (listing import, backfills, consumers, dev setup)

---

## Troubleshooting

**`pnpm run setup` fails with "Postgres is not reachable".**
Make sure Postgres is running (`brew services list` on macOS,
`systemctl status postgresql` on Linux) and that `DATABASE_URL` in
`.env` matches your local user/password/port. Many Homebrew installs
expect `postgresql://$USER@localhost:5432/at_store` (no password).

**`pnpm run setup` says `extension "vector" is not available`.**
You need pgvector installed alongside Postgres:

- macOS: `brew install pgvector && brew services restart postgresql@17`
- Debian/Ubuntu: `sudo apt install postgresql-17-pgvector`

**OAuth sign-in redirects to `localhost` and breaks.**
ATProto's public-client OAuth requires `127.0.0.1`, not `localhost`.
Visit the dev server at `http://127.0.0.1:3000` and make sure
`ATPROTO_BASE_URL=http://127.0.0.1:3000` in `.env`.

---

## License

### Source code

This project’s source code is licensed under the **Apache License,
Version 2.0** (SPDX: `Apache-2.0`). See [`LICENSE`](./LICENSE). Copyright
notice: [`NOTICE`](./NOTICE).

### Site design and branding

Anyone is welcome to reuse and adapt **this codebase** under the Apache
license (similar to how Bluesky core uses permissive licenses).

This site uses a **custom visual design**—layout, typography, imagery,
and the AT Store wordmark. Please **do not reuse that design wholesale**
for another product or site without asking first.

The AT Store wordmark and related branding are **© Atproto Community
Collective**. They are not licensed for unrestricted reuse the same way
the program source is; the distinction between code and visual identity
is intentional.
