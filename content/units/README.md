# Unit content

One file per unit. **Adding a unit means adding a file here — no code changes,
no deploy config, no restart in production.** Copy `_template.json`, rename it,
fill it in.

Files not named `unit-NN.json` (like `_template.json` and this README) are
ignored by the loader, so they can live here safely.

## Rules the loader enforces (`lib/units.ts`)

- Filename must be `unit-NN.json` — two digits, e.g. `unit-07.json`.
- The `id` inside the file must equal the filename without `.json`.
- `title` must be a non-empty string.
- `games` must be a non-empty array.
- Every block needs a known `type`: `unscramble`, `quiz-choice`,
  `sentence-builder`, `listening`, `writing`.
- Every block except `writing` needs a non-empty `items` array.
- `writing` needs `prompt.questions` with at least one question.

Break any of these and the unit **won't appear** to students, the reason is
printed in the server console, and the file is listed under
`/admin/units → Files with errors`.

## Scoring

Every item in a scored block is worth 10 points, one attempt each — no retries.
So a unit's max score is `10 × (number of items outside the writing block)`.
`/admin/units` shows the computed max score per unit; check it looks right
after authoring.

The `writing` block is never scored and the text is never stored. Keep it last.

## Per-type notes

**unscramble** — `scrambled` is what the student sees, `answer` is checked
case-insensitively after trimming. Write both in CAPITALS for consistency.
`scrambled` must be a real anagram of `answer` — same letters, same counts — or
the puzzle is impossible; `npm test` checks every shipped unit for this.
Optional `emoji`: one emoji, shown in full colour above the letters. Leave it
out and the block is a plain word scramble.

> It used to be blacked out into a silhouette until the child answered. The
> teacher had that removed — the job in this part is spelling the word, not
> working out which animal it is. Do not put the silhouette back.

> There was also an `art` field for eight animals that had been drawn as real
> pictures, with a build script and a folder of WebP files behind it. The
> teacher had all of it removed — "เอาพวกภาพที่ฉัน add เข้าไปอะพวกภาพสัตว์เอา
> ออกให้หมด เอาแค่อิโมจิมาใน Part เเรก". **An emoji is the only picture a
> question can have. Do not add artwork back.**

**quiz-choice** — `answerIndex` is 0-based. **Exactly 3 options**, always: the
teacher struck a fourth off every question by hand. `npm test` fails if any
question that has choices offers more or fewer.

**sentence-builder** — `words` is the shuffled pool shown to the student,
`answer` is the correct order. Both are arrays of single words. Repeated words
are fine. `answer` must be a permutation of `words`, and the comparison is
case-insensitive.

**listening** — `audioUrl` is a path relative to `public/audio/`
(e.g. `unit-07/clue-1.mp3`), or a full `https://…` URL for Supabase Storage.
If the file is missing the student hears the browser voice reading `clueText`
instead, so `clueText` must always be the exact words of the recording.
`/admin/units` lists every clip that has no file yet.

**writing** — `prompt.questions` is one textarea per question.
