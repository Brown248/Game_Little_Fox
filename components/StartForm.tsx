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
import type { UnitSummary } from "@/lib/units";

interface Props {
  units: UnitSummary[];
}

export default function StartForm({ units }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState<string | null>(units[0]?.id ?? null);
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
    if (!cleanName || !unitId || busy) return;

    setBusy(true);
    setFailure(null);
    try {
      const player = await findOrCreatePlayer(cleanName);
      savePlayer({ id: player.id, name: player.name });
      // the unit page asks the last question: whole unit, or one part?
      router.push(`/unit/${unitId}`);
    } catch (err) {
      const described = describeFailure(err);
      // Log the extracted text: the raw Supabase error prints as `{}`.
      console.error(`[little-fox] start failed (${described.kind}):`, described.detail);
      setFailure(described);
      setBusy(false);
    }
  }

  const chosen = units.find((u) => u.id === unitId);
  const ready = name.trim().length > 0 && Boolean(unitId);

  return (
    // The card the compass badge hangs off: name, unit, one big slab.
    <div className="join">
      <Image
        className="join__badge"
        src="/little-fox-logo.png"
        alt=""
        width={216}
        height={216}
        priority
      />

      <h2 className="join__title">Join the expedition</h2>

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
          onKeyDown={(e) => {
            if (e.key === "Enter") void start();
          }}
        />
        <span className="muted">
          Use the same name every time so your scores stay together.
        </span>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <div className="progress-head">
          <span className="field__label">Pick your unit</span>
          <span className="kicker kicker--faint">{units.length} ready</span>
        </div>

        {units.length === 0 ? (
          <div className="card card--dashed">
            <p className="muted">
              No units found in <code>content/units/</code> yet.
            </p>
          </div>
        ) : (
          <div className="unit-list">
            {units.map((unit) => (
              <button
                key={unit.id}
                type="button"
                className="unit"
                aria-pressed={unit.id === unitId}
                onClick={() => setUnitId(unit.id)}
              >
                <span className="unit__no">{unit.id.replace("unit-", "")}</span>
                <span className="unit__body">
                  <span className="unit__title">{unit.title}</span>
                  <span className="unit__meta">
                    {unit.questionCount} questions · {unit.maxScore} points
                  </span>
                </span>
                <span className="unit__go" aria-hidden="true">
                  {unit.id === unitId ? "◆" : "›"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {failure && <Failure failure={failure} />}

      <button
        className="btn btn--block"
        type="button"
        disabled={!ready || busy}
        onClick={start}
      >
        {busy ? "Getting ready…" : "Start the expedition"}
      </button>

      {!name.trim() && (
        <p className="muted center">
          Type your name above to start.
        </p>
      )}
      {name.trim() && chosen && (
        <p className="muted center">
          {chosen.title}
        </p>
      )}

      <div className="join__foot">Scanned from QR · no password needed</div>
    </div>
  );
}
