"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Listening from "@/components/games/Listening";
import QuizChoice from "@/components/games/QuizChoice";
import SentenceBuilder from "@/components/games/SentenceBuilder";
import Unscramble from "@/components/games/Unscramble";
import Writing from "@/components/games/Writing";
import ResultScreen from "@/components/ResultScreen";
import { formatTime, partScoreId, scoreIdLabel } from "@/lib/format";
import {
  createScoringState,
  elapsedSeconds,
  recordAnswer,
  type ScoringState,
} from "@/lib/scoring";
import { loadPlayer } from "@/lib/session";
import {
  describeFailure,
  saveAttempt,
  type ScoreboardFailure,
} from "@/lib/supabase";
import type { AttemptRecord, GameBlock, Player, UnitConfig } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  unit: UnitConfig;
  totalUnits: number;
  /** Play one part on its own instead of the whole unit. Index into
   *  unit.games; the attempt is then timed, scored and ranked under that
   *  part's own scoreboard id. */
  partIndex?: number;
}

export default function PlayClient({ unit, totalUnits, partIndex }: Props) {
  // Everything below works off these two, so whole-unit and single-part runs
  // are the same loop with a different slice of the unit and a different id.
  const games = partIndex === undefined ? unit.games : [unit.games[partIndex]];
  const scoreId =
    partIndex === undefined ? unit.id : partScoreId(unit.id, partIndex);

  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);

  const [blockIndex, setBlockIndex] = useState(0);
  // createScoringState is passed by reference, not called: the timer must start
  // once when the page mounts, not on every re-render.
  const [scoring, setScoring] = useState<ScoringState>(createScoringState);
  const [elapsed, setElapsed] = useState(0);
  const [finalSeconds, setFinalSeconds] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveFailure, setSaveFailure] = useState<ScoreboardFailure | null>(null);
  // Display only: consecutive correct answers, never stored or ranked.
  const [streak, setStreak] = useState(0);
  const [askingToLeave, setAskingToLeave] = useState(false);
  const savingRef = useRef(false);

  const finished = finalSeconds !== null;

  // No player in localStorage means someone opened /play/... directly.
  useEffect(() => {
    const saved = loadPlayer();
    setPlayer(saved);
    setCheckedSession(true);
    if (!saved) router.replace("/");
  }, [router]);

  // Live timer. Stops once the unit is finished so the result screen is stable.
  useEffect(() => {
    if (finished) return;
    setElapsed(elapsedSeconds(scoring));
    const id = window.setInterval(() => setElapsed(elapsedSeconds(scoring)), 500);
    return () => window.clearInterval(id);
  }, [scoring, finished]);

  const save = useCallback(async (record: AttemptRecord) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      await saveAttempt(record);
      setSaveState("saved");
    } catch (err) {
      const described = describeFailure(err);
      console.error(`[little-fox] save failed (${described.kind}):`, described.detail);
      setSaveFailure(described);
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  }, []);

  // Fires once when the last block reports done.
  useEffect(() => {
    if (finalSeconds === null || !player || saveState !== "idle") return;
    void save(buildRecord(player, scoreId, scoring, finalSeconds));
  }, [finalSeconds, player, saveState, save, scoring, scoreId]);

  function handleAnswer(gameType: string, isCorrect: boolean) {
    setScoring((state) => recordAnswer(state, gameType, isCorrect));
    setStreak((current) => (isCorrect ? current + 1 : 0));
  }

  function handleDone() {
    if (blockIndex + 1 < games.length) {
      setBlockIndex(blockIndex + 1);
      return;
    }
    // scoring.startedAt never changes after mount, so reading elapsed time from
    // the render closure here is safe even if a score update is still in flight.
    setFinalSeconds(elapsedSeconds(scoring));
  }

  function exit() {
    setAskingToLeave(true);
  }

  if (!checkedSession) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!player) {
    return (
      <main className="page">
        <p className="muted">Taking you back to the start…</p>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="page wipe-up">
        <ResultScreen
          player={player}
          unit={unit}
          scoreId={scoreId}
          scoring={scoring}
          timeSeconds={finalSeconds}
          totalUnits={totalUnits}
          saveState={saveState}
          saveFailure={saveFailure}
          onRetrySave={() =>
            void save(buildRecord(player, scoreId, scoring, finalSeconds))
          }
        />
      </main>
    );
  }

  const block = games[blockIndex];

  return (
    <main className="page">
      {/* Four stat cards: one row on a laptop, 2×2 on a phone, no breakpoint. */}
      <div className="hud">
        <div className="hud__tile">
          <div className="hud__label">Score</div>
          <div className="hud__value hud__value--orange">
            <span className="tick" key={scoring.score}>
              {scoring.score}
            </span>
          </div>
        </div>

        <div className="hud__tile">
          <div className="hud__label">Streak</div>
          <div className="hud__value">
            <span className="tick" key={streak}>
              {streak}
            </span>
          </div>
        </div>

        <div className="hud__tile">
          <div className="hud__label">Time</div>
          <div className="hud__value">
            <span className="tick" key={elapsed}>
              {formatTime(elapsed)}
            </span>
          </div>
        </div>

        <div className="hud__tile hud__tile--me">
          <div className="hud__label">Explorer</div>
          <div className="hud__value hud__value--name">{player.name}</div>
        </div>
      </div>

      <div className="row row--between">
        <div>
          <div className="kicker">
            {scoreIdLabel(scoreId)}
            {partIndex === undefined && (
              <>
                {" · part "}
                {blockIndex + 1} of {games.length}
              </>
            )}
          </div>
          <div style={{ fontWeight: 800 }}>{unit.title}</div>
        </div>
        <button className="exit" type="button" onClick={exit}>
          Exit
        </button>
      </div>

      <div className="segs" aria-hidden="true">
        {games.map((_, i) => (
          <span
            key={i}
            className={`seg${i < blockIndex ? " seg--done" : i === blockIndex ? " seg--now" : ""}`}
          />
        ))}
      </div>

      {renderBlock(block, blockIndex, handleAnswer, handleDone)}

      <ConfirmDialog
        open={askingToLeave}
        title="Leave this expedition?"
        body="Your score will not be saved, and you would start this one again from the beginning."
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onConfirm={() => router.push("/")}
        onCancel={() => setAskingToLeave(false)}
      />
    </main>
  );
}

// The discriminated union on GameBlock.type is what makes this switch safe —
// each branch gets the right item type with no casting. A new game type means
// adding one case here plus one component; the existing branches never change.
function renderBlock(
  block: GameBlock,
  blockIndex: number,
  onAnswer: (gameType: string, isCorrect: boolean) => void,
  onDone: () => void
) {
  // key resets each component's internal state when moving between blocks
  const key = blockIndex;
  const answer = (isCorrect: boolean) => onAnswer(block.type, isCorrect);

  switch (block.type) {
    case "unscramble":
      return (
        <Unscramble key={key} items={block.items} onAnswer={answer} onDone={onDone} />
      );
    case "quiz-choice":
      return (
        <QuizChoice key={key} items={block.items} onAnswer={answer} onDone={onDone} />
      );
    case "sentence-builder":
      return (
        <SentenceBuilder
          key={key}
          items={block.items}
          onAnswer={answer}
          onDone={onDone}
        />
      );
    case "listening":
      return (
        <Listening key={key} items={block.items} onAnswer={answer} onDone={onDone} />
      );
    case "writing":
      // The text itself is deliberately not stored or scored.
      return <Writing key={key} prompt={block.prompt} onDone={() => onDone()} />;
  }
}

function buildRecord(
  player: Player,
  unitId: string,
  scoring: ScoringState,
  timeSeconds: number
): AttemptRecord {
  return {
    player_id: player.id,
    unit_id: unitId,
    score: scoring.score,
    max_score: scoring.maxScore,
    correct_count: scoring.correctCount,
    total_questions: scoring.totalQuestions,
    time_seconds: timeSeconds,
    game_type_breakdown: scoring.breakdown,
  };
}
