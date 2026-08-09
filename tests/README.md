# Tests

Two suites, two commands.

## `npm test` — unit + component (149 tests)

Runs in jsdom, needs nothing running. Covers:

- `lib/scoring.ts` — points, per-skill breakdown, and the immutability that stops
  React StrictMode double-counting.
- `lib/units.ts` — loading, validation (bad id, broken JSON, unknown game type),
  path-traversal rejection, and the content audit (`questionCount`, missing mp3s).
- `lib/format.ts`, `lib/session.ts` (including a `localStorage` that throws),
  `lib/certificate.ts` (jspdf stubbed — asserts what gets drawn and the filename).
- `lib/admin-auth.ts` — the signed cookie: tampering, expiry, wrong password,
  and the fact that changing `ADMIN_PASSWORD` invalidates old sessions.
- `lib/admin-data.ts` — best-attempt-per-unit, weighted accuracy, weakest skill.
- All five game components, driven with real clicks and typing: one answer per
  question, feedback, advancing, the TTS fallback, repeated words in
  sentence-builder.
- `PlayClient` end to end: plays all of `unit-02`, asserts the exact
  `AttemptRecord` that gets saved (once, even under `StrictMode`), the result
  screen, both ranks, and the save-failure retry.
- `StartForm`, both leaderboards, and the admin tables/merge tool.

`npm run test:watch` for the loop while editing.

## `npm run test:db` — integration (62 tests)

Runs the **real** client code against **real** Postgres + PostgREST in Docker,
with real anon/service-role JWTs, so RLS behaves exactly as it will in Supabase.

```bash
docker compose -f tests/db/docker-compose.yml up -d
npm run test:db
docker compose -f tests/db/docker-compose.yml down -v
```

`supabase/schema.sql` is mounted straight from the repo into the container's init
directory, so these tests fail if that file stops being valid SQL — which is how
the broken `unique (lower(trim(name)), class)` table constraint was found.

What it proves:

- The schema applies cleanly: tables, both ranking views, RLS, policies, and the
  case/whitespace-insensitive unique index.
- `v_unit_ranking` keeps the best attempt per player per unit and breaks ties on
  time; `v_overall_ranking` weights by score (10/10 + 0/100 = 9%, not 50%).
- RLS: a student can sign up and record an attempt but **cannot** update or
  delete any row, and impossible scores are rejected.
- `findOrCreatePlayer` dedupes across case, whitespace and `%`/`_` wildcards, and
  recovers from two devices racing.
- The admin actions really move attempts on merge, and refuse everything without
  a session.

### If the containers won't start

Windows sometimes reserves the published port (`bind: An attempt was made to
access a socket in a way forbidden by its access permissions`). Pick another
port in `tests/db/docker-compose.yml` and update `POSTGREST`/`PROXY_PORT` in
`tests/db/setup-global.ts` plus `NEXT_PUBLIC_SUPABASE_URL` in
`vitest.db.config.ts`. Only PostgREST is published; Postgres is reached through
`docker compose exec`.

### Why there is a proxy

supabase-js talks to `${url}/rest/v1/...` while a bare PostgREST serves at `/`.
`tests/db/setup-global.ts` runs a tiny proxy that strips the prefix, so the real
`lib/supabase.ts` can be pointed at the container with no code changes.

## Notes

- `tests/stubs/empty.ts` is aliased over the `server-only` package so the
  server-only libraries can be imported in a test. The real guard still applies
  to `next build`.
- Node 25 ships its own unconfigured `localStorage` global that shadows jsdom's;
  `tests/setup.ts` installs a working in-memory `Storage` instead.
