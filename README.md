# Little Fox Game

Ranked English-learning game for Little Fox Language School. Students scan a QR
code, type their name, and play — one run of every question there is, first to
last, with no unit or part to choose. At the end they see the board and, if they
finished the whole thing and got at least half of it right, download a PDF
certificate. The teacher can print anyone's from `/admin/certificates`.

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
npm test         # 219 unit + component tests (jsdom, nothing to set up)
npm run test:db  # 64 integration tests against real Postgres + PostgREST
```

See `tests/README.md` — the database suite mounts `supabase/schema.sql` into a
throwaway Postgres, so the schema, both ranking views and every RLS policy are
verified for real.

## Structure
```
app/                    routes (pages)
  globals.css            the entire design system (cream/marigold theme)
  play/                  the one game — every block of every unit, in order
  rank/                  the one board, and where a finished run lands
  me/                    a student's own history + certificate re-download
  admin/                 password-gated: overview, students, certificates, content, QR
components/              StartForm, PlayClient (engine loop), RankBoard, MyScores
components/games/        one component per game type (quiz, unscramble, etc.)
components/admin/        admin login, tables, merge tool
content/units/           one JSON file per unit — content only, no logic (see its README)
lib/                     supabase clients, types, scoring, units loader, session,
                         certificate, formatting, admin auth + queries
public/audio/            listening-part mp3 files (or use Supabase Storage instead)
supabase/schema.sql      tables, ranking views, and RLS — run once in the SQL editor
```

## Admin (`/admin`)

One password (`ADMIN_PASSWORD`), no user accounts. Five pages:

- **Overview** — students, certificates earned, runs played, and which skill the
  whole class is weakest at; the 25 most recent attempts.
- **Certificates** — who has earned one (with a button to print theirs) and, for
  everyone else, exactly what they still need to do.
- **Students** — fix a mistyped name, **merge duplicate records**
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
| `unit-01` **Animal Words** | 15 word scrambles, each with its animal shown as an emoji | 15 / 150 |
| `unit-02` **Wild Life and Wonderful Creatures** | 10 clue questions, 5 animal sounds, 10 sentence builders, 7 listening clues, 5 unscored writing prompts | 32 / 320 |

The two files play as **one game of 47 questions / 470 points**. Units are still
how content is written — they match the teacher's paper worksheet — but they are
no longer something a student picks.

## Design decisions already made (see project chat for full reasoning)
- No login and no class — identity is the typed name alone, deduplicated
  case- and whitespace-insensitively in the players table. Two students who
  type the same name share one record, so give one of them a surname.
- Unlimited replays; the board always shows each player's *best* run.
- One board, keyed on `GAME_ID` in `lib/game.ts`. Change the content enough to
  move the question count and that id is bumped, so the board starts clean
  rather than ranking runs that answered different questions against each other.
- Listening audio is pre-generated mp3, not live browser text-to-speech. A clue
  with no recording falls back to the device's own voice, which sounds like a
  robot — so clues ship only once their mp3 exists, and a test enforces it.
- Engine and content are fully separate — adding a unit means adding a JSON
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
