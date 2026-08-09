import { createClient } from "@supabase/supabase-js";
import type {
  AttemptRecord,
  OverallRankingRow,
  Player,
  UnitRankingRow,
} from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // createClient throws on an empty url, which would break `next build` and
  // every page render. Fall back to a dead address instead: queries then fail
  // as network errors, which the pages already surface to the student.
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are not set — copy .env.example to .env.local"
  );
}

export const supabase = createClient(
  url || "http://localhost:54321",
  anonKey || "missing-anon-key"
);

/** False when the keys are missing — or still the placeholders from
 *  .env.example, which fail in a far more confusing way. That's a setup
 *  problem rather than a connection problem, and the screens say so instead of
 *  blaming the wifi. */
export const supabaseConfigured =
  Boolean(url && anonKey) && !/your-(project|anon-key)/.test(`${url}${anonKey}`);

export type FailureKind = "unconfigured" | "offline" | "database";

export interface ScoreboardFailure {
  kind: FailureKind;
  /** Safe to show a student. */
  message: string;
  /** The underlying detail — shown small, and worth pasting to whoever set the
   *  project up. Supabase rejects with a plain object, and a PostgrestError
   *  logs as `{}`, so pulling the text out here is the only way to see it. */
  detail?: string;
}

export function describeFailure(err: unknown): ScoreboardFailure {
  if (!supabaseConfigured) {
    return {
      kind: "unconfigured",
      message: "This app isn't connected to its scoreboard yet.",
      detail:
        "Copy .env.example to .env.local, fill in the Supabase URL and anon key, and run supabase/schema.sql.",
    };
  }

  const candidate = err as
    | { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    | null
    | undefined;

  const text =
    typeof candidate?.message === "string" && candidate.message
      ? candidate.message
      : String(err);
  const code = typeof candidate?.code === "string" ? candidate.code : undefined;
  const extra = [candidate?.details, candidate?.hint]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
  const detail = [code && `[${code}]`, text, extra].filter(Boolean).join(" ");

  // A failed fetch is the only failure a student can do anything about.
  if (/failed to fetch|networkerror|load failed|fetch failed|timeout/i.test(text)) {
    return {
      kind: "offline",
      message: "Could not reach the scoreboard. Check your connection and try again.",
      detail,
    };
  }

  return {
    kind: "database",
    message: "The scoreboard would not accept that. Please tell your teacher.",
    detail,
  };
}

// Finds an existing player by name, or creates a new one. This is the whole
// "identity" system — no login, no class, just the name they type.
export async function findOrCreatePlayer(name: string): Promise<Player> {
  const cleanName = name.trim();

  const existing = await lookupPlayer(cleanName);
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("players")
    .insert({ name: cleanName })
    .select()
    .single();

  if (error) {
    // 23505 = unique violation on lower(trim(name)): another device created
    // this same explorer in the gap above. Re-read instead of failing.
    if (error.code === "23505") {
      const raced = await lookupPlayer(cleanName);
      if (raced) return raced;
    }
    throw error;
  }
  return created as Player;
}

async function lookupPlayer(cleanName: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    // ilike treats % and _ as wildcards, so a name containing either would
    // match the wrong row (or several, which makes maybeSingle throw).
    .ilike("name", escapeLike(cleanName))
    .maybeSingle();

  if (error) throw error;
  return (data as Player | null) ?? null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function saveAttempt(record: AttemptRecord) {
  const { error } = await supabase.from("attempts").insert(record);
  if (error) throw error;
}

export async function getUnitRanking(unitId: string): Promise<UnitRankingRow[]> {
  const { data, error } = await supabase
    .from("v_unit_ranking")
    .select("*")
    .eq("unit_id", unitId)
    .order("score", { ascending: false })
    .order("time_seconds", { ascending: true });

  if (error) throw error;
  return (data ?? []) as UnitRankingRow[];
}

export async function getOverallRanking(): Promise<OverallRankingRow[]> {
  // v_overall_ranking joins players itself — a PostgREST embed can't resolve a
  // relationship through an aggregate view stacked on another view.
  const { data, error } = await supabase
    .from("v_overall_ranking")
    .select("*")
    .order("overall_accuracy", { ascending: false })
    .order("units_completed", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OverallRankingRow[];
}
