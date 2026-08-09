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

// Plays item.audioUrl (Supabase Storage file) via <audio>, then A/B/C/D choice.
// Falls back to browser text-to-speech only if audioUrl is missing.
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
  const video = resolveMediaSrc(item.videoUrl, "videos");
  const src = resolveMediaSrc(item.audioUrl, "audio");
  // No file, or this file is broken: read the clue with the device voice
  // instead. A video clue never falls back — it carries its own soundtrack.
  const useTts = !video && (!src || brokenSrc === src);

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
        title={video ? "Watch and choose" : "Listen and choose"}
        index={index}
        total={items.length}
        answered={answered}
      />

      {/* the player on one side, answers on the other — stacks on a phone */}
      <div className="q split" key={index}>
        <div className="card card--soft stack" style={{ gap: 14 }}>
          {video ? (
            // A video clue is its own player: controls on, no autoplay, so a
            // room full of phones never all start talking at once.
            <video
              className="clip"
              src={video}
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <>
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
            </>
          )}

          <div className="row row--between">
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setShowText(!showText)}
            >
              {showText ? "Hide text" : "Show text"}
            </button>
            {useTts && (
              <span className="kicker--faint kicker">device voice</span>
            )}
          </div>

          {useTts && (
            <p className="muted">
              No recording for this clue yet — using your device&apos;s voice.
            </p>
          )}

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

// unit JSON stores a relative path ("unit-05/clue-1.mp4"), which is resolved
// under public/<folder>/. Absolute URLs (e.g. a Supabase Storage public URL)
// are passed through untouched.
function resolveMediaSrc(
  url: string | undefined,
  folder: "audio" | "videos"
): string | null {
  const path = url?.trim();
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `/${folder}/${path.replace(/^\/+/, "")}`;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
