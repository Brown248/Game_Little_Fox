# Little Fox Game

Ranked English-learning game platform for Little Fox Language School. Students
scan a QR code, type their name, play through a unit of mini-games, see their
rank instantly, and can download a PDF certificate.

Branding lives in one place: `brand/little-fox-logo-master.png` is the master
artwork and everything else is cut from it by `npm run brand` —
`public/little-fox-logo.png` (on screen), `public/little-fox-logo-print.png`
(the PDF certificate: smaller and opaque, which keeps the file at ~40KB instead
of 1MB), `public/little-fox-mark.png` (anything under 64px, including the
browser tab), `app/icon.png`, `app/apple-icon.png` and
`app/opengraph-image.png`. To rebrand: drop in a new master, run the script.

## Stack
Next.js (App Router) + Supabase (Postgres + Storage) + Vercel.
Three runtime dependencies: `@supabase/supabase-js`, `jspdf` (certificate,
lazy-loaded on click) and `qrcode` (server-side QR). No CSS framework — the
whole design system is `app/globals.css`; fonts are self-hosted via `next/font`.

## Design

Built to the "Visual & motion direction v1" doc: marigold · cream · white, one
spring (`cubic-bezier(.34,1.56,.64,1)`) for every interaction, chunky buttons
that squash into their own hard shadow, correct answers that burst and wrong
answers that shake but never turn red. Mobile first — laid out for a 390px
phone, primary tap targets ≥66px, safe-area aware, and `prefers-reduced-motion`
strips the movement while keeping the meaning. All tokens live in `:root` in
`app/globals.css`; components never hard-code a colour or an easing curve.

## Tests

```bash
npm test         # 149 unit + component tests (jsdom, nothing to set up)
npm run test:db  # 62 integration tests against real Postgres + PostgREST
```

See `tests/README.md` — the database suite mounts `supabase/schema.sql` into a
throwaway Postgres, so the schema, both ranking views and every RLS policy are
verified for real.

## Structure
```
app/                    routes (pages)
  globals.css            the entire design system (cream/green/gold theme)
  play/[unitId]/         resolves the unit, then hands off to PlayClient
  leaderboard/[unitId]/  ranking for a single unit
  leaderboard/overall/   accuracy-weighted ranking across all units
  admin/                 password-gated: overview, students, units, QR
components/              StartForm, PlayClient (engine loop), ResultScreen, boards
components/games/        one component per game type (quiz, unscramble, etc.)
components/admin/        admin login, tables, merge tool
content/units/           one JSON file per unit — content only, no logic (see its README)
lib/                     supabase clients, types, scoring, units loader, session,
                         certificate, formatting, admin auth + queries
public/audio/            listening-part mp3 files (or use Supabase Storage instead)
supabase/schema.sql      tables, ranking views, and RLS — run once in the SQL editor
```

## Admin (`/admin`)

One password (`ADMIN_PASSWORD`), no user accounts. Four pages:

- **Overview** — students, attempts, units played, and which skill the whole
  class is weakest at; the 25 most recent attempts.
- **Students** — fix a mistyped name or class, **merge duplicate records**
  (moves the attempts across, deletes the duplicate — nothing is lost), open one
  student to see their per-skill totals and which units they haven't started.
- **Units** — content health: which JSON files failed to load, how many
  questions each unit is worth, which listening clips still have no mp3; plus
  per-unit play stats.
- **QR code** — generated locally (no third-party service), with a print button.

The layout gates rendering; every mutating server action re-checks the session
itself.

## Content

| Unit | What's in it | Questions / points |
|---|---|---|
| `unit-01` **Shadow Animal Challenge** | 30 word scrambles, each behind a black animal silhouette that lights up on answering | 30 / 300 |
| `unit-02` **Wild Life and Wonderful Creatures** | 9 clue/animal-sound questions, 5 sentence builders, 5 listening clues, 7 writing prompts | 19 / 190 |

## Design decisions already made (see project chat for full reasoning)
- No login and no class — identity is the typed name alone, deduplicated
  case- and whitespace-insensitively in the players table. Two students who
  type the same name share one record, so give one of them a surname.
- Unlimited replays; leaderboard always shows each player's *best* attempt per unit.
- Overall ranking uses accuracy (score/max_score), not a raw score sum, so units
  with more questions don't dominate.
- Listening audio is pre-generated mp3, not live browser text-to-speech.
- Engine and content are fully separate — adding unit 21 means adding a JSON
  file, not touching any component.

## Setup
1. `npm install`
2. Create a Supabase project, run `supabase/schema.sql` in its SQL editor.
   **If you ran an earlier version, re-run the whole file** — player identity
   changed (the `class` column is gone) and both ranking views changed with it.
3. Copy `.env.example` to `.env.local` and fill in your Supabase keys.
   Without them the app still builds and renders, but nothing saves.
4. `npm run dev`
5. Deploy to Vercel to get the stable URL the QR code will point to.

## Status

The system is complete and designed: student flow, both leaderboards,
certificate, the four admin pages, the QR generator, row-level security, and two
units of real content. What's left is more content.

**Content still to do**
- More units: drop `content/units/unit-NN.json` in — copy `_template.json` and
  read `content/units/README.md`. Adding a file is the whole job: no code, no
  config, no restart. `/admin/units` shows what loaded and what it's worth.
- Record the five `unit-02` listening clips into `public/audio/unit-02/clue-N.mp3`
  (or Supabase Storage). Until then they fall back to the browser voice —
  `/admin/units` lists every clip that's still missing.

**Deliberately not done**
- The certificate uses a built-in PDF font, so a Thai name renders as boxes.
  Embedding a Thai font is a look-and-feel task.
- No photos in questions and no badges — the JSON has no field for either yet.
