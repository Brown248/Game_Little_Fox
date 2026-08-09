import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import type {
  AttemptWithPlayer,
  PlayerRow,
  PlayerSummary,
  SkillTally,
  UnitStats,
} from "./types";

// Reads and aggregations for the admin pages. The whole dataset is one school's
// worth of rows (~30 students), so everything is fetched once and summarised in
// JS — no extra views to keep in sync with the ranking rules.
// Types and labels live in lib/types.ts / lib/format.ts: this module is
// server-only and client components must be able to render its output.

const ATTEMPT_LIMIT = 5000;

export async function fetchPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("players")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PlayerRow[];
}

export async function fetchAttempts(
  limit = ATTEMPT_LIMIT
): Promise<AttemptWithPlayer[]> {
  const { data, error } = await supabaseAdmin()
    .from("attempts")
    .select("*, players(name)")
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as AttemptWithPlayer[];
}

export async function fetchPlayer(playerId: string): Promise<PlayerRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as PlayerRow | null) ?? null;
}

export async function fetchAttemptsForPlayer(
  playerId: string
): Promise<AttemptWithPlayer[]> {
  const { data, error } = await supabaseAdmin()
    .from("attempts")
    .select("*, players(name)")
    .eq("player_id", playerId)
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as AttemptWithPlayer[];
}

/* ------------------------------- aggregation ------------------------------ */

/** Best attempt per unit: highest score, fastest time breaks the tie.
 *  Mirrors v_unit_ranking — keep the two in step. */
export function bestAttemptPerUnit(
  attempts: AttemptWithPlayer[]
): AttemptWithPlayer[] {
  const best = new Map<string, AttemptWithPlayer>();

  for (const attempt of attempts) {
    const key = `${attempt.player_id}::${attempt.unit_id}`;
    const current = best.get(key);
    if (
      !current ||
      attempt.score > current.score ||
      (attempt.score === current.score &&
        attempt.time_seconds < current.time_seconds)
    ) {
      best.set(key, attempt);
    }
  }

  return [...best.values()];
}

export function summarisePlayers(
  players: PlayerRow[],
  attempts: AttemptWithPlayer[]
): PlayerSummary[] {
  const byPlayer = new Map<string, AttemptWithPlayer[]>();
  for (const attempt of attempts) {
    const list = byPlayer.get(attempt.player_id);
    if (list) list.push(attempt);
    else byPlayer.set(attempt.player_id, [attempt]);
  }

  return players
    .map((player) => summarisePlayer(player, byPlayer.get(player.id) ?? []))
    .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1));
}

export function summarisePlayer(
  player: PlayerRow,
  attempts: AttemptWithPlayer[]
): PlayerSummary {
  const best = bestAttemptPerUnit(attempts);
  const bestScoreTotal = sum(best.map((a) => a.score));
  const maxScoreTotal = sum(best.map((a) => a.max_score));
  const skills = tallySkills(best);

  return {
    player,
    attemptCount: attempts.length,
    unitsPlayed: new Set(attempts.map((a) => a.unit_id)).size,
    accuracy: maxScoreTotal > 0 ? bestScoreTotal / maxScoreTotal : null,
    bestScoreTotal,
    maxScoreTotal,
    totalTimeSeconds: sum(attempts.map((a) => a.time_seconds)),
    lastPlayedAt: attempts[0]?.completed_at ?? null,
    skills,
    weakestSkill: weakest(skills),
  };
}

export function summariseUnits(attempts: AttemptWithPlayer[]): UnitStats[] {
  const byUnit = new Map<string, AttemptWithPlayer[]>();
  for (const attempt of attempts) {
    const list = byUnit.get(attempt.unit_id);
    if (list) list.push(attempt);
    else byUnit.set(attempt.unit_id, [attempt]);
  }

  return [...byUnit.entries()]
    .map(([unitId, unitAttempts]) => {
      const best = bestAttemptPerUnit(unitAttempts);
      const maxTotal = sum(best.map((a) => a.max_score));
      const skills = tallySkills(best);

      return {
        unitId,
        attemptCount: unitAttempts.length,
        playerCount: new Set(unitAttempts.map((a) => a.player_id)).size,
        averageAccuracy: maxTotal > 0 ? sum(best.map((a) => a.score)) / maxTotal : null,
        bestTimeSeconds: best.length
          ? Math.min(...best.map((a) => a.time_seconds))
          : null,
        skills,
        weakestSkill: weakest(skills),
      };
    })
    .sort((a, b) => a.unitId.localeCompare(b.unitId));
}

/** Adds up game_type_breakdown across attempts — this is the "who is weak at
 *  what" signal, and the only reason the column is stored as jsonb. */
export function tallySkills(attempts: AttemptWithPlayer[]): SkillTally[] {
  const totals = new Map<string, SkillTally>();

  for (const attempt of attempts) {
    for (const [gameType, tally] of Object.entries(
      attempt.game_type_breakdown ?? {}
    )) {
      const current = totals.get(gameType) ?? { gameType, correct: 0, total: 0 };
      current.correct += tally?.correct ?? 0;
      current.total += tally?.total ?? 0;
      totals.set(gameType, current);
    }
  }

  return [...totals.values()].sort((a, b) => a.gameType.localeCompare(b.gameType));
}

/** Lowest accuracy skill with enough answers to mean anything. */
function weakest(skills: SkillTally[]): SkillTally | null {
  const scored = skills.filter((s) => s.total >= 3);
  if (scored.length === 0) return null;
  return scored.reduce((worst, s) =>
    s.correct / s.total < worst.correct / worst.total ? s : worst
  );
}

function sum(values: number[]): number {
  return values.reduce((n, v) => n + v, 0);
}
