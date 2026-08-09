"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergePlayersAction } from "@/app/admin/actions";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Option {
  id: string;
  name: string;
  attemptCount: number;
}

// Identity is the typed name on purpose, so one student who spelled their name
// two different ways ends up as two records. This is the repair tool.
export default function MergePlayers({ players }: { players: Option[] }) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  const source = players.find((p) => p.id === sourceId);
  const target = players.find((p) => p.id === targetId);

  function merge() {
    if (!source || !target) return;
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await mergePlayersAction(sourceId, targetId);
      if (result.ok) {
        setSourceId("");
        setTargetId("");
        setDone(true);
        router.refresh();
      } else {
        setError(result.error ?? "Could not merge.");
      }
    });
  }

  return (
    <div className="card stack">
      <h2>Merge duplicate explorers</h2>
      <p className="muted">
        Same student, two spellings? Merging moves every attempt onto the record
        you want to keep and deletes the other. Nothing is lost.
      </p>

      <div className="field">
        <label className="field__label" htmlFor="merge-source">
          Duplicate to remove
        </label>
        <select
          id="merge-source"
          className="select"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          <option value="">Choose…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.attemptCount} attempt(s)
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="merge-target">
          Record to keep
        </label>
        <select
          id="merge-target"
          className="select"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          <option value="">Choose…</option>
          {players
            .filter((p) => p.id !== sourceId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.attemptCount} attempt(s)
              </option>
            ))}
        </select>
      </div>

      {error && <div className="notice notice--error">{error}</div>}
      {done && <div className="notice">Merged.</div>}

      <button
        className="btn"
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending || !source || !target}
      >
        {pending ? "Merging…" : "Merge"}
      </button>

      <ConfirmDialog
        open={asking}
        title="Merge these two records?"
        body={
          source && target
            ? `${source.attemptCount} attempt(s) move from "${source.name}" onto "${target.name}", and the duplicate is deleted.`
            : undefined
        }
        confirmLabel="Merge them"
        onConfirm={() => {
          setAsking(false);
          merge();
        }}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
