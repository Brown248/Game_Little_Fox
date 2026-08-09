"use client";

import { useCallback, useEffect, useState } from "react";
import Failure from "@/components/Failure";
import { formatPercent } from "@/lib/format";
import { loadPlayer } from "@/lib/session";
import {
  describeFailure,
  getOverallRanking,
  type ScoreboardFailure,
} from "@/lib/supabase";
import type { OverallRankingRow } from "@/lib/types";

// Re-queried on every page load — no realtime subscription by design.
export default function OverallLeaderboard({ totalUnits }: { totalUnits: number }) {
  const [rows, setRows] = useState<OverallRankingRow[] | null>(null);
  const [failure, setFailure] = useState<ScoreboardFailure | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    setMeId(loadPlayer()?.id ?? null);
  }, []);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      // Ordered by the query (accuracy desc, then units played). Do not re-sort.
      setRows(await getOverallRanking());
    } catch (err) {
      const described = describeFailure(err);
      console.error(`[little-fox] leaderboard failed (${described.kind}):`, described.detail);
      setFailure(described);
    }
  }, []);

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
          No attempts yet — play a unit to open the board.
        </p>
      </div>
    );
  }

  const top = rows.slice(0, 3);

  return (
    <div className="stack stack--screen">
      {/* the three cards repeat the head of the list — hidden from screen
          readers so the ordered list below stays the single source of truth */}
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
              <span className="podium__meta">
                {row.units_completed} of {totalUnits} units
              </span>
              <span className="podium__score">
                {formatPercent(row.overall_accuracy)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="board-sheet">
        <div className="board-cols" aria-hidden="true">
          <span className="board-cols__rank">#</span>
          <span className="board-cols__who">Explorer</span>
          <span className="board-cols__score">Accuracy</span>
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
                    {row.units_completed} / {totalUnits} units played
                  </span>
                </span>
                <span className="board__score">
                  {formatPercent(row.overall_accuracy)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="board-foot">
        <span className="board-foot__note">
          Ranked by average accuracy, not total score. A student who has finished
          1 unit at 90% is not ahead of one averaging 85% across {totalUnits}.
        </span>
        <button className="btn btn--ghost" type="button" onClick={() => void load()}>
          Refresh
        </button>
      </div>
    </div>
  );
}
