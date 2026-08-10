import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  auditUnits,
  getUnit,
  isScored,
  listBrokenUnitFiles,
  listUnits,
  loadAllUnits,
} from "@/lib/units";

const UNITS_DIR = path.join(process.cwd(), "content", "units");
const temporaryFiles: string[] = [];

function writeTempUnit(name: string, contents: string) {
  const file = path.join(UNITS_DIR, name);
  fs.writeFileSync(file, contents, "utf8");
  temporaryFiles.push(file);
  return file;
}

afterAll(() => {
  for (const file of temporaryFiles) fs.rmSync(file, { force: true });
});

describe("unit loader", () => {
  it("lists the real units on disk", () => {
    const units = listUnits();
    expect(units.length).toBeGreaterThanOrEqual(2);
    expect(units.map((u) => u.id)).toEqual(
      expect.arrayContaining(["unit-01", "unit-02"])
    );
    expect(units.every((u) => /^unit-\d{2}$/.test(u.id))).toBe(true);
  });

  it("reports each unit's scored question count and points", () => {
    const units = listUnits();
    const first = units.find((u) => u.id === "unit-01")!;
    // 15 emoji — the ones the teacher screenshotted and asked to keep
    // ("Part แรกเอาแค่นี้พอตามภาพในโฟลเดอร์ที่เหลือเอาออกเพราะเยอะเกิน").
    // It was 30 on the worksheet, then 27, and is now 15.
    expect(first.questionCount).toBe(15);
    expect(first.maxScore).toBe(150);

    for (const unit of units) {
      expect(unit.maxScore).toBe(unit.questionCount * 10);
    }
  });

  it("ignores files that aren't named unit-NN.json", () => {
    // _template.json and README.md live in the same folder on purpose.
    expect(fs.existsSync(path.join(UNITS_DIR, "_template.json"))).toBe(true);
    expect(listUnits().some((u) => u.id === "_template")).toBe(false);
    expect(listBrokenUnitFiles()).toEqual([]);
  });

  // Unit 1 is one block of emoji.
  it("loads the animal words as one block of emoji", () => {
    const unit = getUnit("unit-01");
    expect(unit).not.toBeNull();
    expect(unit!.title).toBe("Animal Words");
    expect(unit!.games.map((g) => g.type)).toEqual(["unscramble"]);

    const [block] = unit!.games;
    if (block.type !== "unscramble") throw new Error("wrong block type");

    expect(block.items).toHaveLength(15);
    expect(block.items.every((item) => item.emoji)).toBe(true);
  });

  // The teacher had every animal picture removed: the files, the build script
  // and the field that pointed at them. An emoji is the only picture in the
  // game now, and this is what stops artwork drifting back in.
  it("has no animal artwork anywhere", () => {
    for (const unit of loadAllUnits()) {
      for (const block of unit.games) {
        if (block.type !== "unscramble") continue;
        for (const item of block.items) {
          expect((item as { art?: string }).art, unit.id).toBeUndefined();
        }
      }
    }

    expect(fs.existsSync(path.join(process.cwd(), "public", "images"))).toBe(false);
  });

  // The scramble is the whole puzzle: if the letters are not a true anagram of
  // the answer, the question cannot be solved at all. The source worksheet had
  // exactly this bug in one place, so every shipped unit is checked.
  it("keeps every scramble a true anagram of its answer", () => {
    const letters = (value: string) =>
      [...value.toUpperCase().replace(/\s/g, "")].sort().join("");

    for (const unit of loadAllUnits()) {
      for (const block of unit.games) {
        if (block.type !== "unscramble") continue;
        for (const item of block.items) {
          expect(item.scrambled).not.toBe(item.answer);
          expect(letters(item.scrambled), `${unit.id}: ${item.answer}`).toBe(
            letters(item.answer)
          );
        }
      }
    }
  });

  // Unit 2 is the worksheet's Parts B, C, D and E, in that order.
  it("loads unit-02 with all five parts in order", () => {
    const unit = getUnit("unit-02");
    expect(unit).not.toBeNull();
    expect(unit!.title).toBe("Wild Life and Wonderful Creatures");
    expect(unit!.games.map((g) => g.type)).toEqual([
      "quiz-choice", // Part B — guess the animal
      "quiz-choice", // Part C1 — match the sound
      "sentence-builder", // Part C2 — build the sentence
      "listening", // Part D — mythological creatures
      "writing", // Part E + the writing activity
    ]);

    const counts = unit!.games.map((g) =>
      g.type === "writing" ? g.prompt.questions.length : g.items.length
    );
    expect(counts).toEqual([10, 5, 10, 7, 5]);
  });

  // Two rules the teacher set for Part C2 after watching a class use it.
  describe("Part C2 — build the sentence", () => {
    const partC2 = () => {
      const block = getUnit("unit-02")!.games[2];
      if (block.type !== "sentence-builder") throw new Error("wrong block type");
      return block.items;
    };

    // The cue read "🐍 Hiss! Hiss!", which gave away the verb — half the
    // sentence the child is supposed to be building.
    it("cues with the animal alone, never a word", () => {
      for (const item of partC2()) {
        expect(/\p{L}|\p{N}/u.test(item.prompt), item.prompt).toBe(false);
        expect(item.prompt.length).toBeGreaterThan(0);
      }
    });

    it("has no sentence built on 'loudly'", () => {
      for (const item of partC2()) {
        expect([...item.words, ...item.answer].join(" ")).not.toMatch(/loudly/i);
      }
    });
  });

  // Every audio clue must point at a file that is actually shipped, or the
  // class will fall back to the device voice when it should not.
  it("every audio clue has its file on disk", () => {
    const clips = loadAllUnits()
      .flatMap((unit) => unit.games)
      .flatMap((block) => (block.type === "listening" ? block.items : []))
      .map((item) => item.audioUrl)
      .filter((url): url is string => Boolean(url) && !/^https?:\/\//.test(url!));

    expect(clips.length).toBeGreaterThan(0);

    for (const url of clips) {
      const file = path.join(process.cwd(), "public", "audio", url);
      expect(fs.existsSync(file), url).toBe(true);
    }
  });

  // Part D shipped with question 10 repeating question 2 word for word — the
  // same unicorn clue twice in one part, with only the wrong answers changed.
  // Nothing was checking, so nothing said so; a child just heard it again.
  it("never asks the same listening clue twice", () => {
    const seen = new Map<string, string>();

    for (const unit of loadAllUnits()) {
      for (const block of unit.games) {
        if (block.type !== "listening") continue;
        for (const item of block.items) {
          const key = item.clueText.trim().toLowerCase();
          expect(seen.has(key), `${unit.id}: "${item.clueText}"`).toBe(false);
          seen.set(key, unit.id);
        }
      }
    }
  });

  // Three, not four. The teacher went through Part B question by question and
  // struck out one option on each — "Part นี้มีแค่ 3 choice พอ" — and a fourth
  // creeping back into one question would make that question quietly harder
  // than the rest of the game.
  it("offers exactly three choices on every question that has choices", () => {
    for (const unit of loadAllUnits()) {
      for (const block of unit.games) {
        if (block.type !== "quiz-choice" && block.type !== "listening") continue;
        for (const item of block.items) {
          expect(item.options.length, `${unit.id}: ${item.options.join("/")}`).toBe(3);
        }
      }
    }
  });

  it("keeps every answerIndex inside its options list", () => {
    for (const unit of loadAllUnits()) {
      for (const block of unit.games) {
        if (block.type !== "quiz-choice" && block.type !== "listening") continue;
        for (const item of block.items) {
          expect(
            item.answerIndex,
            `${unit.id}: ${JSON.stringify(item.options)}`
          ).toBeLessThan(item.options.length);
          expect(item.answerIndex).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("keeps every sentence answer a permutation of its words", () => {
    for (const unit of loadAllUnits()) {
      for (const block of unit.games) {
        if (block.type !== "sentence-builder") continue;
        for (const item of block.items) {
          expect([...item.answer].sort()).toEqual([...item.words].sort());
        }
      }
    }
  });

  it("puts writing last and treats it as unscored", () => {
    const unit = getUnit("unit-02")!;
    const last = unit.games[unit.games.length - 1];
    expect(last.type).toBe("writing");
    expect(isScored(last)).toBe(false);
    expect(unit.games.filter((g) => isScored(g))).toHaveLength(4);
  });

  it("rejects ids that aren't unit-NN, including path traversal", () => {
    expect(getUnit("../../package")).toBeNull();
    expect(getUnit("unit-2")).toBeNull();
    expect(getUnit("unit-002")).toBeNull();
    expect(getUnit("")).toBeNull();
    expect(getUnit("unit-99")).toBeNull(); // valid shape, no file
  });

  it("sorts units by id", () => {
    const ids = loadAllUnits().map((u) => u.id);
    expect([...ids].sort()).toEqual(ids);
  });

  describe("validation", () => {
    it("rejects a unit whose id doesn't match its filename", () => {
      writeTempUnit(
        "unit-90.json",
        JSON.stringify({ id: "unit-91", title: "x", games: [{ type: "writing", prompt: { questions: ["q"] } }] })
      );
      expect(getUnit("unit-90")).toBeNull();
      expect(listBrokenUnitFiles()).toContain("unit-90.json");
    });

    it("rejects invalid JSON, a missing title, and an empty games array", () => {
      writeTempUnit("unit-91.json", "{ not json");
      writeTempUnit("unit-92.json", JSON.stringify({ id: "unit-92", games: [] }));
      writeTempUnit(
        "unit-93.json",
        JSON.stringify({ id: "unit-93", title: "x", games: [] })
      );

      expect(getUnit("unit-91")).toBeNull();
      expect(getUnit("unit-92")).toBeNull();
      expect(getUnit("unit-93")).toBeNull();
    });

    it("rejects an unknown game type and an empty items array", () => {
      writeTempUnit(
        "unit-94.json",
        JSON.stringify({
          id: "unit-94",
          title: "x",
          games: [{ type: "spelling-bee", items: [{ a: 1 }] }],
        })
      );
      writeTempUnit(
        "unit-95.json",
        JSON.stringify({ id: "unit-95", title: "x", games: [{ type: "unscramble", items: [] }] })
      );
      writeTempUnit(
        "unit-96.json",
        JSON.stringify({
          id: "unit-96",
          title: "x",
          games: [{ type: "writing", prompt: { questions: [] } }],
        })
      );

      expect(getUnit("unit-94")).toBeNull();
      expect(getUnit("unit-95")).toBeNull();
      expect(getUnit("unit-96")).toBeNull();
    });

    it("accepts a valid new unit with no code change", () => {
      writeTempUnit(
        "unit-97.json",
        JSON.stringify({
          id: "unit-97",
          title: "Added at runtime",
          games: [
            {
              type: "quiz-choice",
              items: [{ clue: "c", options: ["a", "b"], answerIndex: 1 }],
            },
          ],
        })
      );

      expect(getUnit("unit-97")?.title).toBe("Added at runtime");
      const summary = listUnits().find((u) => u.id === "unit-97");
      expect(summary).toMatchObject({ questionCount: 1, maxScore: 10 });
    });
  });

  describe("audit", () => {
    it("computes questions and max score, excluding writing", () => {
      const audit = auditUnits().find((a) => a.id === "unit-02")!;
      // 10 quiz + 5 sounds + 10 sentences + 7 creatures = 32 scored questions.
      // Part B and Part C2 were cut to the questions the teacher screenshotted;
      // Part D lost the three clues that had no recording.
      expect(audit.questionCount).toBe(32);
      expect(audit.maxScore).toBe(320);
      expect(audit.gameCount).toBe(5);
      expect(audit.hasWriting).toBe(true);
      expect(audit.writingIsLast).toBe(true);
    });

    it("counts writing questions in the block list but not in the score", () => {
      const audit = auditUnits().find((a) => a.id === "unit-02")!;
      const writing = audit.blocks.find((b) => b.type === "writing")!;
      // The teacher replaced 17 sentence frames with 5 open questions:
      // "Part เขียนปรับให้เหลือแค่นี้พอ".
      expect(writing.count).toBe(5);
      expect(audit.blocks.reduce((n, b) => n + b.count, 0)).toBe(37);
    });

    // The teacher's "what still needs recording" list. A clue with no audioUrl
    // at all MUST appear, because it is the easiest way to end up on the robot
    // voice unnoticed.
    it("lists every clue that falls back to the device voice", () => {
      const audit = auditUnits().find((a) => a.id === "unit-02")!;
      const block = getUnit("unit-02")!.games.find((g) => g.type === "listening");
      if (block?.type !== "listening") throw new Error("no listening block");

      const withAudio = block.items.filter((i) => i.audioUrl).length;
      const withoutAudio = block.items.length - withAudio;

      expect(audit.audio).toHaveLength(withoutAudio);
      // Every shipped clue has its mp3 now: the three that did not were read by
      // the device voice, the teacher heard the robot, and they were taken out
      // rather than left on it. Should any clue lose its recording, this list is
      // what surfaces it.
      expect(withoutAudio).toBe(0);
      expect(audit.audio).toEqual([]);
    });

    it("reports a unit with no listening block as having no clips", () => {
      const audit = auditUnits().find((a) => a.id === "unit-01")!;
      expect(audit.audio).toEqual([]);
    });

    it("treats an absolute URL as present and flags writing that isn't last", () => {
      writeTempUnit(
        "unit-98.json",
        JSON.stringify({
          id: "unit-98",
          title: "Remote audio",
          games: [
            {
              type: "writing",
              prompt: { questions: ["first, which is wrong"] },
            },
            {
              type: "listening",
              items: [
                {
                  audioUrl: "https://example.supabase.co/storage/clue.mp3",
                  clueText: "text",
                  options: ["a", "b"],
                  answerIndex: 0,
                },
              ],
            },
          ],
        })
      );

      const audit = auditUnits().find((a) => a.id === "unit-98")!;
      // A clue that names a file — local or a full https:// URL — is already
      // recorded, so it does NOT appear on the "still to record" list. This
      // assertion used to read audit.audio[0], from back when the audit
      // returned a row per clip with a fileExists flag on it.
      expect(audit.audio).toEqual([]);
      expect(audit.writingIsLast).toBe(false);
      expect(audit.questionCount).toBe(1);
    });
  });
});
