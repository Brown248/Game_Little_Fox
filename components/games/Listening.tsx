"use client";

import { useEffect, useRef, useState } from "react";
import type { ListeningItem } from "@/lib/types";
import ChoiceList from "./ChoiceList";
import Progress from "./Progress";

interface Props {
  items: ListeningItem[];
  onAnswer: (isCorrect: boolean) => void;
  onDone: () => void;
}

// Plays item.audioUrl through <audio>, then the choices. Falls back to the
// browser's own voice only when there is no recording, or the file will not
// load.
//
// Sound only, deliberately: the clues arrived as video and the teacher asked
// for just the audio ("เอาเเค่เสียงไม่เอาคลิปมาด้วยได้ไหม"). public/videos and
// the <video> branch that played it are gone with it — a clip in a lesson is
// something a child watches instead of listens to, and this part is listening.
export default function Listening({ items, onAnswer, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [showText, setShowText] = useState(false);
  const [playing, setPlaying] = useState(false);
  // The one clue whose file refused to load, remembered by its URL so moving to
  // the next clue clears itself — no effect needed to reset it.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const item = items[index];
  const isLast = index === items.length - 1;
  const answered = picked !== null;
  const wasRight = picked === item.answerIndex;
  const src = resolveMediaSrc(item.audioUrl);
  // No file, or this file is broken: read the clue with the device voice.
  const useTts = !src || brokenSrc === src;

  // Never leave speech running when the explorer moves on.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function play() {
    setPlaying(true);
    window.setTimeout(() => setPlaying(false), 900);

    if (!useTts && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setBrokenSrc(src));
      return;
    }
    speak(item.clueText);
  }

  function pick(choice: number) {
    if (answered) return; // one shot per question
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPicked(choice);
    onAnswer(choice === item.answerIndex);
  }

  function next() {
    if (isLast) {
      onDone();
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setShowText(false);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Progress
        title="Listen and choose"
        index={index}
        total={items.length}
        answered={answered}
      />

      {/* the player on one side, answers on the other — stacks on a phone */}
      <div className="q split" key={index}>
        <div className="card card--soft stack" style={{ gap: 14 }}>
          {src && (
            <audio
              ref={audioRef}
              src={src}
              preload="auto"
              onError={() => setBrokenSrc(src)}
            />
          )}

          <button
            className="btn btn--block"
            type="button"
            onClick={play}
            style={
              playing
                ? { transform: "translateY(3px) scaleY(.97)", boxShadow: "0 4px 0 var(--marigold-press)" }
                : undefined
            }
          >
            <span aria-hidden="true">🔊</span> Play the clue
          </button>

          <div className="row row--between">
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setShowText(!showText)}
            >
              {showText ? "Hide text" : "Show text"}
            </button>
            {/* One mark, not two: this chip and a sentence underneath used to
                say the same thing on the same card. */}
            {useTts && (
              <span className="kicker--faint kicker">no recording yet</span>
            )}
          </div>

          {showText && (
            <p className="clue">
              <strong>{item.clueText}</strong>
            </p>
          )}
        </div>

        <div className="stack">
          <ChoiceList
            options={item.options}
            answerIndex={item.answerIndex}
            picked={picked}
            onPick={pick}
          />

          {answered && (
            <>
              <div
                className={`feedback ${wasRight ? "feedback--correct" : "feedback--wrong"}`}
                role="status"
              >
                {wasRight ? "Correct! 🎉" : "Not quite."}
                {!wasRight && (
                  <span className="feedback__answer">
                    The answer is <strong>{item.options[item.answerIndex]}</strong>
                  </span>
                )}
              </div>
              <button className="btn btn--block" type="button" onClick={next}>
                {isLast ? "Finish this part" : "Next clue"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// unit JSON stores a relative path ("unit-02/clue-1.mp3"), resolved under
// public/audio/. Absolute URLs (e.g. a Supabase Storage public URL) are passed
// through untouched.
function resolveMediaSrc(url: string | undefined): string | null {
  const path = url?.trim();
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `/audio/${path.replace(/^\/+/, "")}`;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
