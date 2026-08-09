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
  /** How many units are waiting, for the line under the button. */
  unitCount: number;
}

// One field, one button. The unit list used to sit in this card as well, so
// arriving at the game meant reading a name box AND a menu before anything
// happened — the teacher's word was "เข้าใจยากมาก". Now the door asks one
// question and the choosing happens on the next screen.
export default function StartForm({ unitCount }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ScoreboardFailure | null>(
    // Say it up front rather than after a student has typed their name.
    supabaseConfigured ? null : describeFailure(null)
  );

  // Returning explorer: prefill the name they used last time.
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
      router.push("/units");
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
    // The card the fox badge hangs off: a name and one big slab.
    <div className="join">
      <Image
        className="join__badge"
        src="/little-fox-logo.png"
        alt=""
        width={216}
        height={216}
        priority
      />

      <h2 className="join__title">Type your name to play</h2>

      <div className="field">
        <label className="field__label" htmlFor="name">
          What&apos;s your explorer name?
        </label>
        <input
          id="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your name"
          autoComplete="name"
          enterKeyHint="go"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") void start();
          }}
        />
        <span className="muted">
          Use the same name every time so your scores stay together.
        </span>
      </div>

      {failure && <Failure failure={failure} />}

      <button
        className="btn btn--block"
        type="button"
        disabled={!ready || busy}
        onClick={start}
      >
        {busy ? "Getting ready…" : "Start"}
      </button>

      <p className="muted center">
        {ready
          ? `Next: pick one of ${unitCount} unit${unitCount === 1 ? "" : "s"}.`
          : "Type your name above to start."}
      </p>

      <div className="join__foot">Scanned from QR · no password needed</div>
    </div>
  );
}
