"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Failure from "@/components/Failure";
import { formatTime } from "@/lib/format";
import { loadPlayer } from "@/lib/session";
import {
  describeFailure,
  getUnitRanking,
  type ScoreboardFailure,
} from "@/lib/supabase";
import type { UnitRankingRow } from "@/lib/types";

// Re-queried on every page load — no realtime subscription by design.
export default function UnitLeaderboard({ unitId }: { unitId: string }) {
  const [rows, setRows] = useState<UnitRankingRow[] | null>(null);
  const [failure, setFailure] = useState<ScoreboardFailure | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    setMeId(loadPlayer()?.id ?? null);
  }, []);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      // Order comes from the view + query (best attempt, score desc, time asc).
      // Never re-sort here or the ranking rules stop matching the database.
      setRows(await getUnitRanking(unitId));
    } catch (err) {
      const described = describeFailure(err);
      console.error(`[little-fox] leaderboard failed (${described.kind}):`, described.detail);
      setFailure(described);
    }
  }, [unitId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failure) {
    return (
      <Failure failure={failure}>
        <button className="btn btn--sm" type="button" onClick={() => void load()}>
          Try again
        </button>
      </Failure>
    );
  }

  if (!rows) return <p className="muted">Loading…</p>;

  if (rows.length === 0) {
    return (
      <div className="card card--dashed">
        <p className="muted">
          Nobody has finished this unit yet. Be the first!
        </p>
      </div>
    );
  }

  const top = rows.slice(0, 3);

  return (
    <div className="stack stack--screen">
      {/* the three cards, then everybody in one sheet underneath */}
      {top.length === 3 && (
        <div className="podium" aria-hidden="true">
          {top.map((row, i) => (
            <div
              key={row.player_id}
              className={`podium__card${i === 0 ? " podium__card--first" : ""}${
                row.player_id === meId ? " podium__card--me" : ""
              }`}
            >
              <span className="podium__medal">{i + 1}</span>
              <span className="podium__name">{row.name}</span>
              <span className="podium__meta">{formatTime(row.time_seconds)}</span>
              <span className="podium__score">{row.score}</span>
            </div>
          ))}
        </div>
      )}

      <div className="board-sheet">
        <div className="board-cols" aria-hidden="true">
          <span className="board-cols__rank">#</span>
          <span className="board-cols__who">Explorer</span>
          <span className="board-cols__score">Score</span>
        </div>

        <ol className="board">
          {rows.map((row, i) => {
            const mine = row.player_id === meId;
            return (
              <li
                key={row.player_id}
                className={`board__row${mine ? " board__row--me" : ""}${
                  i > 5 && !mine ? " board__row--faded" : ""
                }`}
              >
                {mine && <span className="board__you">YOU</span>}
                <span
                  className={`board__place${i < 3 ? " board__place--top" : ""}`}
                  aria-label={`Place ${i + 1}`}
                >
                  {i + 1}
                </span>
                <span className="board__who">
                  <span className="board__name">{row.name}</span>
                  <span className="board__meta">
                    {formatTime(row.time_seconds)} · {row.score}/{row.max_score}
                  </span>
                </span>
                <span className="board__score">{row.score}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="board-foot">
        <span className="board-foot__note">
          Each explorer&apos;s best attempt only. Same score? The faster run wins.
        </span>
        <div className="row row--tight">
          <button className="btn btn--ghost" type="button" onClick={() => void load()}>
            Refresh
          </button>
          <Link className="btn" href={`/play/${unitId}`}>
            Play this unit
          </Link>
        </div>
      </div>
    </div>
  );
}
