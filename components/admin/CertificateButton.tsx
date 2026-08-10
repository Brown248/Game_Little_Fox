"use client";

import { useEffect, useState } from "react";
import { downloadCertificate, warmCertificate } from "@/lib/certificate";

interface Props {
  name: string;
  gameTitle: string;
  gameId: string;
  score: number;
  maxScore: number;
  timeSeconds: number;
  /** When the run happened. A teacher printing a stack of these weeks later
   *  must not stamp today's date on every child's certificate. */
  completedAt: string;
}

// Prints one student's certificate from the teacher's own device.
//
// The child normally gets this themselves on /rank, but a child who played at
// home and could not work the download, or who has changed phones, otherwise
// has no way to reach it. The teacher can now hand it over.
//
// Exactly the same PDF: it goes through downloadCertificate() with that
// student's real numbers, so nothing about it is a teacher-only variant.
export default function CertificateButton({
  name,
  gameTitle,
  gameId,
  score,
  maxScore,
  timeSeconds,
  completedAt,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A teacher printing a stack of these taps one after another; fetch jspdf and
  // the logo once, up front, so none of those taps waits on the network.
  useEffect(() => {
    warmCertificate();
  }, []);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      await downloadCertificate({
        name,
        unitId: gameId,
        unitTitle: gameTitle,
        score,
        maxScore,
        timeSeconds,
        accuracy: maxScore > 0 ? score / maxScore : 0,
        completedAt,
      });
    } catch (err) {
      console.error("[little-fox] admin certificate failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="btn btn--sm"
        type="button"
        disabled={busy}
        onClick={() => void make()}
      >
        {busy ? "Making…" : "Certificate"}
      </button>
      {error && (
        <span className="roster__error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
