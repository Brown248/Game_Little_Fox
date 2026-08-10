import "server-only";

import { loadAllUnits } from "./units";
import type { GameBlock } from "./types";

// There is one game. Not a unit to pick, not a part to pick — every question in
// content/units/, in order, played from the first one to the last.
//
// The teacher's instruction was "ไม่ต้องมีให้เลือกว่าจะไปทำ Part ไหนหรือข้อไหน
// Unit ไหน แต่ให้เริ่มที่ข้อแรกไปเลย". The unit files stay exactly as they are —
// they are still how content is written and still what the teacher's worksheet
// is organised by. They are simply no longer something a child is asked about.

/** What every attempt is saved and ranked under.
 *
 *  The trailing number is not decoration. A score only means something next to
 *  another score from the SAME set of questions, so when the content changes
 *  enough to move the total (the teacher has already said more is coming),
 *  bump this to `game-02` and the board starts clean instead of putting a run
 *  of 104 questions next to a run of 130.
 *
 *  It deliberately does NOT look like `unit-NN`: v_overall_ranking in
 *  supabase/schema.sql filters on `^unit-[0-9]{2}$`, which is what keeps the
 *  old per-unit attempts — Fai's 390/400 and the rest — on their own boards and
 *  out of this one. No SQL had to change for that; the shape does the work. */
export const GAME_ID = "game-01";

/** Every block from every unit, in the order they are played.
 *
 *  Units are sorted by id and each unit's `games` array keeps its file order,
 *  so the run reads unit-01 part 1, unit-01 part 2, unit-02 part B, and so on.
 *  A new unit-03.json appends itself to the end of the game with no code
 *  change, which is the same promise the project has always made. */
export function buildGame(): GameBlock[] {
  return loadAllUnits().flatMap((unit) => unit.games);
}

/** How many scored questions a complete run has.
 *
 *  The certificate rule turns on this number, and BOTH screens that hand one
 *  out need it. It lived as a copy-pasted reduce on /rank and another on /me;
 *  the day they disagreed would be the day one screen issued a certificate the
 *  other refused. */
export function fullQuestionCount(): number {
  return buildGame().reduce(
    (n, block) => n + (block.type === "writing" ? 0 : block.items.length),
    0
  );
}
