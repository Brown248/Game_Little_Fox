import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { animalArt } from "@/lib/format";
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
    // Part 1's 27 emoji shadows + Part 2's 8 illustrated ones. Five animals
    // came out on the teacher's list after the first lesson: giraffe, flamingo
    // and parrot from Part 1, and from Part 2 the rhinoceros plus the second
    // polar bear, which was the same word twice.
    expect(first.questionCount).toBe(35);
    expect(first.maxScore).toBe(350);

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

  // Unit 1 is the worksheet's Part 1 (emoji silhouettes) followed by Part 2,
  // the animals that have been drawn for real.
  it("loads the shadow challenge with both of its parts", () => {
    const unit = getUnit("unit-01");
    expect(unit).not.toBeNull();
    expect(unit!.title).toBe("Shadow Animal Challenge");
    expect(unit!.games.map((g) => g.type)).toEqual(["unscramble", "unscramble"]);

    const [part1, part2] = unit!.games;
    if (part1.type !== "unscramble" || part2.type !== "unscramble")
      throw new Error("wrong block type");

    expect(part1.items).toHaveLength(27);
    expect(part1.items.every((item) => item.shadow && !item.art)).toBe(true);

    expect(part2.items).toHaveLength(8);
    expect(part2.items.every((item) => item.art)).toBe(true);
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

  // The drawn animals are the best content in the game; a typo in a slug would
  // silently fall back to the emoji, so the files are checked for real.
  it("every artwork slug has both of its files on disk", () => {
    const drawn = loadAllUnits()
      .flatMap((unit) => unit.games)
      .filter((block) => block.type === "unscramble")
      .flatMap((block) => (block.type === "unscramble" ? block.items : []))
      .filter((item) => item.art);

    expect(drawn.length).toBeGreaterThan(0);

    for (const item of drawn) {
      const { shadow, reveal } = animalArt(item.art!);
      for (const url of [shadow, reveal]) {
        const file = path.join(process.cwd(), "public", url.replace(/^\//, ""));
        expect(fs.existsSync(file), `${item.answer} → ${url}`).toBe(true);
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
    expect(counts).toEqual([30, 5, 25, 9, 17]);
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

  // Every video clue must point at a file that is actually shipped, or a class
  // watches a broken player with no way to answer.
  it("every video clue has its file on disk", () => {
    const clips = loadAllUnits()
      .flatMap((unit) => unit.games)
      .flatMap((block) => (block.type === "listening" ? block.items : []))
      .map((item) => item.videoUrl)
      .filter((url): url is string => Boolean(url) && !/^https?:\/\//.test(url!));

    expect(clips.length).toBeGreaterThan(0);

    for (const url of clips) {
      const file = path.join(process.cwd(), "public", "videos", url);
      expect(fs.existsSync(file), url).toBe(true);
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
      // 30 quiz + 5 sounds + 25 sentences + 9 creatures = 69 scored questions.
      // Part C2 lost its five "loudly" sentences on the teacher's instruction.
      expect(audit.questionCount).toBe(69);
      expect(audit.maxScore).toBe(690);
      expect(audit.gameCount).toBe(5);
      expect(audit.hasWriting).toBe(true);
      expect(audit.writingIsLast).toBe(true);
    });

    it("counts writing questions in the block list but not in the score", () => {
      const audit = auditUnits().find((a) => a.id === "unit-02")!;
      const writing = audit.blocks.find((b) => b.type === "writing")!;
      // 7 spirit-animal frames + 10 speaking prompts
      expect(writing.count).toBe(17);
      expect(audit.blocks.reduce((n, b) => n + b.count, 0)).toBe(86);
    });

    // The teacher's "what still needs recording" list. A video clue carries its
    // own soundtrack and must not appear; a clue with no audioUrl at all MUST,
    // because it is the easiest way to end up on the robot voice unnoticed.
    it("lists every clue that falls back to the device voice, and no video one", () => {
      const audit = auditUnits().find((a) => a.id === "unit-02")!;
      const block = getUnit("unit-02")!.games.find((g) => g.type === "listening");
      if (block?.type !== "listening") throw new Error("no listening block");

      const withVideo = block.items.filter((i) => i.videoUrl).length;
      const withoutVideo = block.items.length - withVideo;

      expect(audit.audio).toHaveLength(withoutVideo);
      expect(audit.audio.every((clip) => clip.fileExists === false)).toBe(true);
      // no mp3 has been recorded yet, so none of them names a file
      expect(audit.audio.every((clip) => clip.audioUrl === "")).toBe(true);
      expect(audit.audio.map((clip) => clip.position)).toEqual([7, 8, 9]);
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
      expect(audit.audio[0]).toMatchObject({ remote: true, fileExists: true });
      expect(audit.writingIsLast).toBe(false);
      expect(audit.questionCount).toBe(1);
    });
  });
});
