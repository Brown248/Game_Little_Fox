// Server-only unit loader. Reads content/units/*.json at request time so that
// adding a unit means adding a JSON file — no code change, no registry to edit.
// (next.config.js force-includes content/units/** so this works on Vercel too.)

import fs from "node:fs";
import path from "node:path";
import { gameLabel, partScoreId } from "./format";
import type { GameBlock, GameType, UnitConfig } from "./types";

const UNITS_DIR = path.join(process.cwd(), "content", "units");
const UNIT_ID = /^unit-\d{2}$/;

const GAME_TYPES: GameType[] = [
  "quiz-choice",
  "unscramble",
  "sentence-builder",
  "listening",
  "writing",
];

export interface UnitSummary {
  id: string;
  title: string;
  gameCount: number;
  /** Scored questions only — the writing block never counts. */
  questionCount: number;
  maxScore: number;
}

/** Every unit that has a JSON file, sorted by id. */
export function listUnits(): UnitSummary[] {
  return loadAllUnits().map((unit) => {
    const questionCount = countQuestions(unit);
    return {
      id: unit.id,
      title: unit.title,
      gameCount: unit.games.length,
      questionCount,
      maxScore: questionCount * POINTS_PER_QUESTION,
    };
  });
}

/** One separately playable part of a unit. */
export interface PartSummary {
  /** Index into unit.games. */
  index: number;
  /** What an attempt on this part is saved and ranked under. */
  scoreId: string;
  /** "Part 3 · Sentence builder" */
  label: string;
  type: GameType;
  questionCount: number;
  maxScore: number;
}

/** The parts of a unit that can be played on their own.
 *
 *  Writing is left out: it is never scored, so a "rank" for it would be a table
 *  of zeroes. It still plays as the tail of the whole unit. */
export function listParts(unitId: string): PartSummary[] {
  const unit = getUnit(unitId);
  if (!unit) return [];

  return unit.games
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isScored(block))
    .map(({ block, index }) => {
      const questionCount = block.type === "writing" ? 0 : block.items.length;
      return {
        index,
        scoreId: partScoreId(unit.id, index),
        // the worksheet's own name for the part when it has one, so two blocks
        // of the same game type don't read as the same thing
        label: block.title ?? `Part ${index + 1} · ${gameLabel(block.type)}`,
        type: block.type,
        questionCount,
        maxScore: questionCount * POINTS_PER_QUESTION,
      };
    });
}

/** Matches the default in lib/scoring.ts — one shot per question, 10 points. */
const POINTS_PER_QUESTION = 10;

function countQuestions(unit: UnitConfig): number {
  return unit.games.reduce(
    (n, block) => (block.type === "writing" ? n : n + block.items.length),
    0
  );
}

/** Full configs, sorted by id. Used by the admin content check. */
export function loadAllUnits(): UnitConfig[] {
  return unitFileIds()
    .map((id) => readUnit(id))
    .filter((u): u is UnitConfig => u !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** ids of files named unit-NN.json. Anything else in the folder (a template,
 *  notes) is ignored on purpose so it can live next to the real units. */
function unitFileIds(): string[] {
  let files: string[];
  try {
    files = fs.readdirSync(UNITS_DIR);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .filter((id) => UNIT_ID.test(id))
    .sort();
}

/** One unit by id, or null if the file is missing or malformed. */
export function getUnit(unitId: string): UnitConfig | null {
  if (!UNIT_ID.test(unitId)) return null; // also blocks path traversal
  return readUnit(unitId);
}

function readUnit(unitId: string): UnitConfig | null {
  if (!UNIT_ID.test(unitId)) return null;

  let raw: string;
  try {
    raw = fs.readFileSync(path.join(UNITS_DIR, `${unitId}.json`), "utf8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`[units] ${unitId}.json is not valid JSON`);
    return null;
  }

  return validateUnit(parsed, unitId);
}

// Light runtime check — the JSON files are hand-authored, so a typo should show
// up as "unit not found" rather than as a crash halfway through a game.
function validateUnit(value: unknown, unitId: string): UnitConfig | null {
  const reject = (why: string) => {
    console.error(`[units] ${unitId}.json rejected: ${why}`);
    return null;
  };

  if (typeof value !== "object" || value === null) return reject("not an object");
  const unit = value as Record<string, unknown>;

  if (unit.id !== unitId) return reject(`id must be "${unitId}"`);
  if (typeof unit.title !== "string" || !unit.title) return reject("missing title");
  if (!Array.isArray(unit.games) || unit.games.length === 0)
    return reject("games must be a non-empty array");

  for (const [i, block] of unit.games.entries()) {
    const why = validateBlock(block);
    if (why) return reject(`games[${i}]: ${why}`);
  }

  return unit as unknown as UnitConfig;
}

function validateBlock(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return "not an object";
  const block = value as Record<string, unknown>;
  const type = block.type;

  if (typeof type !== "string" || !GAME_TYPES.includes(type as GameType))
    return `unknown type "${String(type)}"`;

  if (type === "writing") {
    const prompt = block.prompt as Record<string, unknown> | undefined;
    if (!prompt || !Array.isArray(prompt.questions) || prompt.questions.length === 0)
      return "writing needs prompt.questions";
    return null;
  }

  if (!Array.isArray(block.items) || block.items.length === 0)
    return `${type} needs a non-empty items array`;

  return null;
}

/** Narrowing helper so callers can keep the union tight. */
export function isScored(block: GameBlock): boolean {
  return block.type !== "writing";
}

/* ------------------------- content health (admin) ------------------------- */

export interface AudioCheck {
  unitId: string;
  /** Empty when the clue names no file at all — the commonest way to end up on
   *  the device voice, and the one a "no missing files" check used to miss. */
  audioUrl: string;
  /** false = the student will hear browser TTS instead of a recording. */
  fileExists: boolean;
  remote: boolean;
  /** Which clue it is, 1-based, so the teacher knows what to record. */
  position: number;
}

export interface UnitAudit {
  id: string;
  title: string;
  gameCount: number;
  /** Scored questions only — the writing block never counts. */
  questionCount: number;
  maxScore: number;
  blocks: { type: GameType; count: number }[];
  audio: AudioCheck[];
  hasWriting: boolean;
  /** Writing is meant to be the last block; flag it when it isn't. */
  writingIsLast: boolean;
}

/** Every JSON file the loader rejected, with the filename — so a typo in a new
 *  unit shows up on the admin page instead of only in the server log. */
export function listBrokenUnitFiles(): string[] {
  let files: string[];
  try {
    files = fs.readdirSync(UNITS_DIR);
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith(".json"))
    .filter((f) => {
      const id = f.replace(/\.json$/, "");
      return UNIT_ID.test(id) && readUnit(id) === null;
    });
}

export function auditUnits(): UnitAudit[] {
  return loadAllUnits().map((unit) => {
    const blocks = unit.games.map((block) => ({
      type: block.type,
      count: block.type === "writing" ? block.prompt.questions.length : block.items.length,
    }));

    const questionCount = countQuestions(unit);

    // Every clue that will NOT play a recording, so the teacher can see what is
    // left to record. A clue with an audioUrl is already recorded and is
    // skipped; a clue with no audioUrl at all is listed, because that is the
    // easiest way to end up on the device voice and the easiest one to overlook.
    const audio: AudioCheck[] = [];
    for (const block of unit.games) {
      if (block.type !== "listening") continue;
      for (const [i, item] of block.items.entries()) {
        if (item.audioUrl?.trim()) continue;

        audio.push({
          unitId: unit.id,
          audioUrl: "",
          remote: false,
          position: i + 1,
          fileExists: false,
        });
      }
    }

    const lastBlock = unit.games[unit.games.length - 1];
    return {
      id: unit.id,
      title: unit.title,
      gameCount: unit.games.length,
      questionCount,
      maxScore: questionCount * POINTS_PER_QUESTION,
      blocks,
      audio,
      hasWriting: unit.games.some((b) => b.type === "writing"),
      writingIsLast: lastBlock?.type === "writing",
    };
  });
}

function audioFileExists(relativePath: string): boolean {
  const clean = relativePath.replace(/^\/+/, "");
  if (clean.includes("..")) return false;
  return fs.existsSync(path.join(process.cwd(), "public", "audio", clean));
}
