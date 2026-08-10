"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Listening from "@/components/games/Listening";
import QuizChoice from "@/components/games/QuizChoice";
import SentenceBuilder from "@/components/games/SentenceBuilder";
import Unscramble from "@/components/games/Unscramble";
import Writing from "@/components/games/Writing";
import { formatTime } from "@/lib/format";
import { clearProgress, loadProgress, saveProgress } from "@/lib/progress";
import {
  createScoringState,
  elapsedSeconds,
  recordAnswer,
  resumeScoringState,
  type ScoringState,
} from "@/lib/scoring";
import { loadPlayer } from "@/lib/session";
import {
  describeFailure,
  saveAttempt,
  type ScoreboardFailure,
} from "@/lib/supabase";
import type { AttemptRecord, GameBlock, Player } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  /** Every block of every unit, already in playing order. */
  games: GameBlock[];
  /** What the finished run is saved and ranked under. */
  gameId: string;
}

// The whole game: one run, first question to last, no choosing anywhere.
//
// It used to take a unit and an optional part index and slice the content down
// to whichever the child had picked. Both are gone — "ไม่ต้องมีให้เลือกว่าจะไป
// ทำ Part ไหนหรือข้อไหน Unit ไหน แต่ให้เริ่มที่ข้อแรกไปเลย".
export default function PlayClient({ games, gameId }: Props) {
  const router = useRouter();
  // Scored questions in this run. Derived from the blocks themselves rather
  // than passed in, so it can never disagree with what is actually played, and
  // it is what a saved run is checked against before being offered back.
  const questionCount = useMemo(
    () =>
      games.reduce(
        (n, block) => n + (block.type === "writing" ? 0 : block.items.length),
        0
      ),
    [games]
  );
  const [player, setPlayer] = useState<Player | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);
  /** null until we know whether there is a run to offer. */
  const [askingToResume, setAskingToResume] = useState(false);

  const [blockIndex, setBlockIndex] = useState(0);
  // createScoringState is passed by reference, not called: the timer must start
  // once when the page mounts, not on every re-render.
  const [scoring, setScoring] = useState<ScoringState>(createScoringState);
  const [elapsed, setElapsed] = useState(0);
  /** null until the last block reports done; then the run's final time. */
  const [finalSeconds, setFinalSeconds] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveFailure, setSaveFailure] = useState<ScoreboardFailure | null>(null);
  // Display only: consecutive correct answers, never stored or ranked.
  const [streak, setStreak] = useState(0);
  const [askingToFinish, setAskingToFinish] = useState(false);
  const savingRef = useRef(false);

  // No player in localStorage means someone opened /play directly.
  useEffect(() => {
    const saved = loadPlayer();
    setPlayer(saved);
    setCheckedSession(true);
    if (!saved) {
      router.replace("/");
      return;
    }
    // Half a run left on this device? Offer it rather than resuming silently —
    // a child who wanted a fresh go would otherwise be dropped into the middle
    // of an old one with no way back to question one.
    if (loadProgress(saved.id, games.length, questionCount)) setAskingToResume(true);
  }, [router, games.length, questionCount]);

  const finished = finalSeconds !== null;

  // Live timer. Stops once the run is finished so the result is stable.
  useEffect(() => {
    if (finished) return;
    setElapsed(elapsedSeconds(scoring));
    const id = window.setInterval(() => setElapsed(elapsedSeconds(scoring)), 500);
    return () => window.clearInterval(id);
  }, [scoring, finished]);

  const save = useCallback(
    async (record: AttemptRecord) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaveState("saving");
      try {
        await saveAttempt(record);
        // The run is banked; nothing left to resume.
        clearProgress();
        setSaveState("saved");
        // replace, not push: the game must not be sitting behind the ranking in
        // history. Pressing back from the ranking goes to the name screen, as
        // the teacher asked — before this it walked straight back into a
        // finished game and started it again.
        router.replace("/rank");
      } catch (err) {
        const described = describeFailure(err);
        console.error(`[little-fox] save failed (${described.kind}):`, described.detail);
        setSaveFailure(described);
        setSaveState("error");
      } finally {
        savingRef.current = false;
      }
    },
    [router]
  );

  // Fires once when the last block reports done.
  useEffect(() => {
    if (finalSeconds === null || !player || saveState !== "idle") return;
    void save(buildRecord(player, gameId, scoring, finalSeconds));
  }, [finalSeconds, player, saveState, save, scoring, gameId]);

  function resume() {
    if (!player) return;
    const saved = loadProgress(player.id, games.length, questionCount);
    setAskingToResume(false);
    if (!saved) return;

    setBlockIndex(saved.blockIndex);
    setScoring(resumeScoringState(saved.scoring, saved.playedSeconds));
  }

  function startOver() {
    clearProgress();
    setAskingToResume(false);
  }

  function handleAnswer(gameType: string, isCorrect: boolean) {
    setScoring((state) => recordAnswer(state, gameType, isCorrect));
    setStreak((current) => (isCorrect ? current + 1 : 0));
  }

  /** Stop early and bank what has been answered so far.
   *
   *  A run is every question there is, but a class only reaches them a part at
   *  a time — a child taught up to Part 1 would otherwise face 35 questions
   *  from lessons they have not had, and lose the lot by closing the tab. This
   *  is the way out, and it keeps the score.
   *
   *  Saving early costs nothing: replays are kept and the board shows each
   *  player's BEST run, so a short run can never displace a longer one. */
  function finishEarly() {
    setAskingToFinish(false);
    // Opened by mistake and answered nothing: there is no score to keep, and a
    // 0-of-0 row on the board would be noise.
    if (scoring.totalQuestions === 0) {
      clearProgress();
      router.push("/");
      return;
    }
    setFinalSeconds(elapsedSeconds(scoring));
  }

  function handleDone() {
    // scoring.startedAt never changes after mount, so reading elapsed time from
    // the render closure here is safe even if a score update is still in flight.
    const played = elapsedSeconds(scoring);

    if (blockIndex + 1 < games.length) {
      const next = blockIndex + 1;
      setBlockIndex(next);
      if (player) {
        saveProgress({
          playerId: player.id,
          blockIndex: next,
          scoring,
          playedSeconds: played,
          blockCount: games.length,
          questionCount,
        });
      }
      return;
    }

    setFinalSeconds(played);
  }

  if (!checkedSession || !player) {
    return (
      <main className="page">
        <p className="muted">Please wait…</p>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="page">
        {saveState === "error" ? (
          <div className="card card--lg stack">
            <h1>Your score did not save</h1>
            <p className="muted">{saveFailure?.message}</p>
            <button
              className="btn btn--block"
              type="button"
              onClick={() => {
                setSaveState("idle");
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          <p className="muted">Please wait…</p>
        )}
      </main>
    );
  }

  // No unit files reached the server — the exact failure next.config.js's
  // outputFileTracingIncludes exists to prevent. Say so instead of reading
  // games[0] off an empty array and throwing into the error boundary.
  if (games.length === 0) {
    return (
      <main className="page">
        <div className="card card--dashed">
          <p className="muted">No questions yet. Please tell your teacher.</p>
        </div>
      </main>
    );
  }

  const block = games[blockIndex];

  return (
    <main className="page">
      {/* Sticky strip: three short numbers that stay on one line at 360px, so
          the clock never leaves the screen. */}
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
          <div className="hud__label">In a row</div>
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
      </div>

      <div className="row row--between">
        <div>
          <div className="kicker">
            Part {blockIndex + 1} of {games.length}
          </div>
          <div style={{ fontWeight: 800 }}>{player.name}</div>
        </div>
        <button
          className="exit"
          type="button"
          onClick={() => setAskingToFinish(true)}
        >
          Finish
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

      {/* Carrying on is the SAFE answer, so it is the one Escape and Enter
          land on. It used to be the other way round: "Start again" was the
          cancel, which meant a stray Escape on a classroom iPad keyboard threw
          away every answer since the last block — none of which is in the
          database yet, because a score is written only when a run ends. */}
      <ConfirmDialog
        open={askingToResume}
        title="Carry on where you stopped?"
        body="Your score and time are still here."
        confirmLabel="Start again"
        cancelLabel="Carry on"
        onConfirm={startOver}
        onCancel={resume}
      />

      <ConfirmDialog
        open={askingToFinish}
        title="Finish here?"
        body="Your score so far will be saved."
        confirmLabel="Finish now"
        cancelLabel="Keep playing"
        onConfirm={finishEarly}
        onCancel={() => setAskingToFinish(false)}
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
  gameId: string,
  scoring: ScoringState,
  timeSeconds: number
): AttemptRecord {
  return {
    player_id: player.id,
    unit_id: gameId,
    score: scoring.score,
    max_score: scoring.maxScore,
    correct_count: scoring.correctCount,
    total_questions: scoring.totalQuestions,
    time_seconds: timeSeconds,
    game_type_breakdown: scoring.breakdown,
  };
}
