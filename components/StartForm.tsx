"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Failure from "@/components/Failure";
import {
  describeFailure,
  findOrCreatePlayer,
  supabaseConfigured,
  type ScoreboardFailure,
} from "@/lib/supabase";
import { loadPlayer, savePlayer } from "@/lib/session";

interface Props {
  /** How many questions the whole game is, for the line under the button. */
  questionCount: number;
}

// The whole first screen: a name and a button.
//
// It used to say "type your name" four separate ways — a heading, a label, a
// placeholder and a hint underneath — plus a line about QR codes. One
// instruction now, in the label the field actually needs.
//
// It is also the only screen a child sees before deciding whether this looks
// like fun, so the fox is big and it moves. Every bit of that is on the
// project's one spring and its own tokens, and every loop stops under
// prefers-reduced-motion: cute, not busy.
export default function StartForm({ questionCount }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ScoreboardFailure | null>(
    // Say it up front rather than after a student has typed their name.
    supabaseConfigured ? null : describeFailure(null)
  );

  // Returning player: prefill the name they used last time.
  useEffect(() => {
    const saved = loadPlayer();
    if (saved) setName(saved.name);
  }, []);

  async function start() {
    const cleanName = name.trim();
    if (!cleanName || busy) return;

    setBusy(true);
    setFailure(null);
    try {
      const player = await findOrCreatePlayer(cleanName);
      savePlayer({ id: player.id, name: player.name });
      router.push("/play");
    } catch (err) {
      const described = describeFailure(err);
      // Log the extracted text: the raw Supabase error prints as `{}`.
      console.error(`[little-fox] start failed (${described.kind}):`, described.detail);
      setFailure(described);
      setBusy(false);
    }
  }

  const ready = name.trim().length > 0;

  return (
    <div className="door">
      {/* Four shapes drifting up behind the card. Decoration only, and the
          screen reader is told nothing about them. */}
      <div className="door__sky" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>

      {/* Re-keyed on `ready` so the fox gives a little hop the moment a name is
          there — the only answer a child gets before they press Play. */}
      <div
        className={`door__fox${ready ? " door__fox--happy" : ""}`}
        key={String(ready)}
      >
        <span className="door__glow" aria-hidden="true" />
        {/* 208, not 432. Without a `sizes` hint next/image builds its srcSet
            from this number, so declaring 432 for a fox that never draws wider
            than 196px had a phone downloading the 640px cut: 75KB where 30KB
            shows the same picture. */}
        <Image src="/little-fox-logo.png" alt="" width={208} height={208} priority />
      </div>

      <div className="join">
        <div className="field">
          <label className="field__label field__label--lg" htmlFor="name">
            Type your name
          </label>
          <input
            id="name"
            className="input input--name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            enterKeyHint="go"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void start();
            }}
          />
        </div>

        {failure && <Failure failure={failure} />}

        <button
          className={`btn btn--block${ready && !busy ? " btn--ready" : ""}`}
          type="button"
          disabled={!ready || busy}
          onClick={start}
        >
          {busy ? "Please wait…" : "Play"}
        </button>

        {/* The real number from the unit files, and the only text left here. */}
        <div className="join__foot">{questionCount} questions</div>
      </div>
    </div>
  );
}
