"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Failure from "@/components/Failure";
import { downloadCertificate } from "@/lib/certificate";
import {
  certificateNeeds,
  earnsCertificate,
  formatPercent,
  formatTime,
  gameLabel,
  parsePartId,
  scoreIdLabel,
} from "@/lib/format";
import type { ScoringState } from "@/lib/scoring";
import {
  getOverallRanking,
  getUnitRanking,
  type ScoreboardFailure,
} from "@/lib/supabase";
import type { Player, UnitConfig } from "@/lib/types";

interface Props {
  player: Player;
  unit: UnitConfig;
  /** What this run was saved under  the unit id, or a part's own id when only
   *  one part was played. Rankings and the board link both follow it. */
  scoreId: string;
  scoring: ScoringState;
  timeSeconds: number;
  totalUnits: number;
  saveState: "idle" | "saving" | "saved" | "error";
  /** Why the save failed, when it did. */
  saveFailure?: ScoreboardFailure | null;
  onRetrySave: () => void;
}

interface RankInfo {
  unitPlace: number | null;
  unitTotal: number;
  overallPlace: number | null;
  overallTotal: number;
  overallAccuracy: number | null;
  unitsCompleted: number;
}

export default function ResultScreen({
  player,
  unit,
  scoreId,
  scoring,
  timeSeconds,
  totalUnits,
  saveState,
  saveFailure,
  onRetrySave,
}: Props) {
  const [rank, setRank] = useState<RankInfo | null>(null);
  const [rankError, setRankError] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const accuracy = scoring.maxScore > 0 ? scoring.score / scoring.maxScore : 0;
  const shownScore = useCountUp(scoring.score);

  // Rankings are read only after the attempt is stored, otherwise the explorer
  // would see a placing that does not include the run they just finished.
  useEffect(() => {
    if (saveState !== "saved") return;
    let active = true;

    (async () => {
      try {
        const [unitRows, overallRows] = await Promise.all([
          getUnitRanking(scoreId),
          getOverallRanking(),
        ]);
        if (!active) return;

        const unitIndex = unitRows.findIndex((r) => r.player_id === player.id);
        const overallIndex = overallRows.findIndex((r) => r.player_id === player.id);
        const mine = overallIndex >= 0 ? overallRows[overallIndex] : null;

        setRank({
          unitPlace: unitIndex >= 0 ? unitIndex + 1 : null,
          unitTotal: unitRows.length,
          overallPlace: overallIndex >= 0 ? overallIndex + 1 : null,
          overallTotal: overallRows.length,
          overallAccuracy: mine?.overall_accuracy ?? null,
          unitsCompleted: mine?.units_completed ?? 0,
        });
      } catch (err) {
        console.error(err);
        if (active) setRankError(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [saveState, scoreId, player.id]);

  async function certificate() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadCertificate({
        name: player.name,
        // the certificate names what was actually played, part or whole unit
        unitId: scoreId,
        unitTitle: unit.title,
        score: scoring.score,
        maxScore: scoring.maxScore,
        timeSeconds,
        accuracy,
        rankLabel:
          rank?.unitPlace ? `${rank.unitPlace} / ${rank.unitTotal}` : undefined,
      });
    } catch (err) {
      // Never swallow this. A button that does nothing when pressed is the
      // worst possible outcome for a child who has earned the certificate —
      // and it left us with no idea why it failed either.
      console.error("[little-fox] certificate failed:", err);
      setPdfError(err instanceof Error ? err.message : String(err));
    } finally {
      setPdfBusy(false);
    }
  }

  const perfect = scoring.maxScore > 0 && scoring.score === scoring.maxScore;

  // Both halves of the rule live in lib/format so /me issues exactly the same
  // certificates this screen does.
  const playedOnePart = parsePartId(scoreId) !== null;
  const earnedCertificate = earnsCertificate(
    scoreId,
    scoring.correctCount,
    scoring.totalQuestions
  );
  const needed = certificateNeeds(scoring.totalQuestions);

  return (
    // Payoff on the left (seal, headline, what to do next), the numbers on the
    // right — one column as soon as the glass gets narrow.
    <div className="split split--wide">
      <div className="result-hero">
        <div className="confetti" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <div className="rank-seal">
          <div className="rank-seal__inner">
            <span className="rank-seal__label">RANK</span>
            <span className="rank-seal__value">
              {rank?.unitPlace ?? "–"}
            </span>
            <span className="rank-seal__of">
              {rank ? `OF ${rank.unitTotal}` : "IN THIS UNIT"}
            </span>
          </div>
        </div>

        <div className="result-title">
          <h1>{perfect ? "Perfect expedition!" : "Great expedition!"}</h1>
          <p className="lead" style={{ margin: 0, textAlign: "center" }}>
            {player.name} · {unit.title}
          </p>
        </div>

        <div className="btn-row">
          {earnedCertificate && (
            <button
              className="btn"
              type="button"
              onClick={certificate}
              disabled={pdfBusy}
            >
              {pdfBusy ? "Making your certificate…" : "Get my certificate"}
            </button>
          )}
          <button
            className="btn btn--secondary"
            type="button"
            // A full reload, not router.refresh(): the engine's client state has
            // to be thrown away so the timer and score start from zero.
            onClick={() => window.location.reload()}
          >
            {playedOnePart ? "Play this part again" : "Play this unit again"}
          </button>
        </div>

        {pdfError && (
          <div className="notice notice--error">
            <strong>The certificate would not open.</strong> Show this to your
            teacher: <code>{pdfError}</code>
          </div>
        )}

        {/* Say what the certificate needs, so a near miss reads as one more go
            rather than a missing button. */}
        {!earnedCertificate && (
          <p className="muted center">
            {playedOnePart
              ? "Certificates come from playing a whole unit — this was one part."
              : `Answer ${needed} of ${scoring.totalQuestions} right to earn a certificate. You got ${scoring.correctCount}.`}
          </p>
        )}

        <div className="row row--between">
          <Link href="/units">Pick another unit</Link>
          <Link href={`/leaderboard/${scoreId}`}>
            {parsePartId(scoreId) ? "Part board" : "Unit board"}
          </Link>
          <Link href="/leaderboard/overall">Top explorers</Link>
        </div>

        {/* The way back to this score after the tab is closed — and to the
            certificate, which used to exist only on this screen. */}
        <p className="muted center">
          This run is saved. Find it again under{" "}
          <Link href="/me">My scores</Link>.
        </p>
      </div>

      <div className="stack" style={{ gap: 20 }}>
        <div className="card card--lg stack" style={{ gap: 20 }}>
          <div className="score-line">
            <div>
              <div className="stat__label">Score</div>
              <div className="score-big">
                <span>{shownScore}</span>
                <small>/{scoring.maxScore}</small>
              </div>
            </div>
            {perfect && <span className="tag">full marks</span>}
          </div>

          <hr className="divider" />

          <div className="stats stagger">
            <div className="stat">
              <div className="stat__label">Time</div>
              <div className="stat__value">{formatTime(timeSeconds)}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Accuracy</div>
              <div className="stat__value">{formatPercent(accuracy)}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Correct</div>
              <div className="stat__value">
                {scoring.correctCount}/{scoring.totalQuestions}
              </div>
            </div>
          </div>
        </div>

        {saveState === "saving" && <div className="notice">Saving your score…</div>}
        {saveState === "error" && (
          <Failure
            failure={
              saveFailure ?? {
                kind: "offline",
                message: "Your score could not be saved.",
              }
            }
          >
            <span>Your result above is still correct.</span>
            <button className="btn btn--sm" type="button" onClick={onRetrySave}>
              Try again
            </button>
          </Failure>
        )}

        {saveState === "saved" && (
          <div className="card stack" style={{ gap: 12 }}>
            <h2>Your ranking</h2>
            {rankError && (
              <div className="notice notice--error">
                Score saved, but the leaderboard could not be loaded right now.
              </div>
            )}
            {!rankError && !rank && <p className="muted">Loading rankings…</p>}
            {rank && (
              <>
                <div className="rank-line">
                  <span className="rank-line__place">
                    {rank.unitPlace ? `#${rank.unitPlace}` : "—"}
                  </span>
                  <span>
                    in {scoreIdLabel(scoreId)}
                    <br />
                    <span className="muted">of {rank.unitTotal} explorers</span>
                  </span>
                </div>
                <div className="rank-line">
                  <span className="rank-line__place">
                    {rank.overallPlace ? `#${rank.overallPlace}` : "—"}
                  </span>
                  <span>
                    overall
                    <br />
                    <span className="muted">of {rank.overallTotal} explorers</span>
                  </span>
                </div>
                <p className="muted">
                  Overall rank is your average accuracy{" "}
                  {rank.overallAccuracy !== null && (
                    <strong>({formatPercent(rank.overallAccuracy)})</strong>
                  )}{" "}
                  across {rank.unitsCompleted} of {totalUnits} unit
                  {totalUnits === 1 ? "" : "s"} played — not a total of raw scores,
                  so longer units don&apos;t dominate.
                </p>
              </>
            )}
          </div>
        )}

        <div className="card stack" style={{ gap: 4 }}>
          <h2>Skills</h2>
          <div className="breakdown">
            {Object.entries(scoring.breakdown).map(([gameType, tally]) => (
              <div className="breakdown__row" key={gameType}>
                <span>{gameLabel(gameType)}</span>
                <span className="breakdown__score">
                  {tally.correct} / {tally.total}
                </span>
              </div>
            ))}
            {Object.keys(scoring.breakdown).length === 0 && (
              <span className="muted">Nothing scored in this unit.</span>
            )}
          </div>
          <p className="muted">
            The writing part is practice only and is not scored.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Counts up from zero so the final score lands as a reward, not a fact.
 *  Skipped entirely when the explorer asked for reduced motion. */
function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion() || target <= 0) {
      setValue(target);
      return;
    }

    // Frame-counted rather than clock-driven: one less thing to go wrong on a
    // slow phone, and it behaves the same everywhere.
    const totalFrames = Math.max(1, Math.round(durationMs / 16));
    let frame = 0;
    setValue(0);

    const id = window.setInterval(() => {
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      // ease-out so it decelerates into the final number
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress >= 1) window.clearInterval(id);
    }, 16);

    return () => window.clearInterval(id);
  }, [target, durationMs]);

  return value;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
