import { execFileSync } from "node:child_process";
import path from "node:path";

const COMPOSE = path.join(process.cwd(), "tests", "db", "docker-compose.yml");

/** Runs SQL in the test container as superuser. Returns rows as arrays of
 *  column strings (psql -tA with | as the separator). */
export function sql(statement: string): string[][] {
  const out = execFileSync(
    "docker",
    ["compose", "-f", COMPOSE, "exec", "-T", "db", "psql", "-U", "postgres", "-tAF|", "-c", statement],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // psql echoes a command tag for every non-SELECT statement; those aren't rows.
    .filter((line) => !COMMAND_TAG.test(line))
    .map((line) => line.split("|"));
}

const COMMAND_TAG =
  /^(SET|DO|BEGIN|COMMIT|ROLLBACK|TRUNCATE TABLE|CREATE \w+|DROP \w+|NOTICE:.*|(INSERT|UPDATE|DELETE|SELECT) \d+( \d+)?)$/;

/** One scalar value. */
export function scalar(statement: string): string | null {
  const rows = sql(statement);
  return rows[0]?.[0] ?? null;
}

/** Runs SQL as a specific role, so RLS applies exactly as it would to a
 *  student holding the anon key. */
export function sqlAs(role: string, statement: string): string[][] {
  return sql(`set local role ${role}; ${statement}`);
}

/** Runs SQL as a role and returns the error, or null when it succeeded. */
export function expectSqlError(role: string, statement: string): string | null {
  try {
    execFileSync(
      "docker",
      [
        "compose",
        "-f",
        COMPOSE,
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        // verbose errors include the SQLSTATE, which the app code branches on
        "-v",
        "VERBOSITY=verbose",
        "-c",
        `begin; set local role ${role}; ${statement}; commit;`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    return null;
  } catch (err) {
    const e = err as { stderr?: Buffer | string; stdout?: Buffer | string };
    return String(e.stderr ?? e.stdout ?? "unknown error");
  }
}

export function resetDb(): void {
  sql("truncate attempts, players cascade;");
}

/** Seeds an explorer and returns its id. */
export function seedPlayer(name: string): string {
  return scalar(
    `insert into players (name) values ('${name.replace(/'/g, "''")}') returning id;`
  )!;
}

export interface SeedAttempt {
  playerId: string;
  unitId: string;
  score: number;
  maxScore?: number;
  timeSeconds?: number;
  correct?: number;
  total?: number;
  breakdown?: Record<string, { correct: number; total: number }>;
}

export function seedAttempt(attempt: SeedAttempt): string {
  const {
    playerId,
    unitId,
    score,
    maxScore = 100,
    timeSeconds = 100,
    correct = score / 10,
    total = maxScore / 10,
    breakdown = {},
  } = attempt;

  return scalar(
    `insert into attempts
       (player_id, unit_id, score, max_score, correct_count, total_questions, time_seconds, game_type_breakdown)
     values
       ('${playerId}', '${unitId}', ${score}, ${maxScore}, ${correct}, ${total}, ${timeSeconds}, '${JSON.stringify(breakdown)}'::jsonb)
     returning id;`
  )!;
}
