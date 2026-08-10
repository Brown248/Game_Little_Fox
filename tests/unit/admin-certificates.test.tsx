import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AttemptWithPlayer, PlayerRow } from "@/lib/types";

// The teacher's certificate page, rendered for real.
//
// It exists because the page is a server component reading a live database:
// on a fresh install both lists are empty, so nothing about the populated
// screen — the medal rows, the download button, the sentence telling the
// teacher what each child still needs — is ever seen until a class has played.
// These tests are the only place it gets looked at with data in it.

const fetchPlayers = vi.fn();
const fetchAttempts = vi.fn();

vi.mock("@/lib/admin-data", async (importOriginal) => ({
  // certificateRoster stays REAL — it is the rule under test.
  ...(await importOriginal<typeof import("@/lib/admin-data")>()),
  fetchPlayers: () => fetchPlayers(),
  fetchAttempts: () => fetchAttempts(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  serviceConfigured: () => true,
}));

// 12 questions is easier to reason about than the real 50, and the page takes
// the number from here rather than hard-coding it anywhere.
vi.mock("@/lib/game", () => ({
  GAME_ID: "game-01",
  fullQuestionCount: () => 12,
}));

// jspdf must never be pulled into a test run; the button's own behaviour is
// covered in certificate.test.ts.
vi.mock("@/lib/certificate", () => ({
  downloadCertificate: vi.fn(),
  warmCertificate: () => {},
}));

import AdminCertificatesPage from "@/app/admin/certificates/page";

function player(id: string, name: string): PlayerRow {
  return { id, name, created_at: "2026-01-01T00:00:00.000Z" };
}

function run(
  playerId: string,
  correct: number,
  total: number
): AttemptWithPlayer {
  return {
    id: `a-${playerId}-${total}-${correct}`,
    player_id: playerId,
    unit_id: "game-01",
    score: correct * 10,
    max_score: total * 10,
    correct_count: correct,
    total_questions: total,
    time_seconds: 300,
    game_type_breakdown: undefined,
    completed_at: "2026-06-01T09:00:00.000Z",
    players: { name: "" },
  };
}

async function show() {
  render(await AdminCertificatesPage());
}

beforeEach(() => {
  fetchPlayers.mockReset();
  fetchAttempts.mockReset();
});

describe("/admin/certificates", () => {
  it("says what the certificate takes, in real numbers", async () => {
    fetchPlayers.mockResolvedValue([]);
    fetchAttempts.mockResolvedValue([]);
    await show();

    // 12 questions, half of them right
    expect(screen.getByText(/all 12 questions with at least 6 right/i)).toBeTruthy();
  });

  it("does not congratulate a class that has no students in it", async () => {
    fetchPlayers.mockResolvedValue([]);
    fetchAttempts.mockResolvedValue([]);
    await show();

    expect(screen.getByText("No students yet.")).toBeTruthy();
    expect(screen.queryByText(/Everyone has one/)).toBeNull();
  });

  it("lists an earned certificate with a button to print it", async () => {
    fetchPlayers.mockResolvedValue([player("p1", "Fai")]);
    fetchAttempts.mockResolvedValue([run("p1", 10, 12)]);
    await show();

    expect(screen.getByText("Fai")).toBeTruthy();
    expect(screen.getByText(/10\/12 right/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Certificate" })).toBeTruthy();
  });

  // Each of these is a different conversation with the child, so the page has
  // to tell them apart rather than saying "not yet" three times.
  it("tells the teacher exactly what each student still needs", async () => {
    fetchPlayers.mockResolvedValue([
      player("p1", "Never"),
      player("p2", "Stopped"),
      player("p3", "Short"),
    ]);
    fetchAttempts.mockResolvedValue([
      run("p2", 5, 5), // perfect, but only 5 of 12 questions
      run("p3", 4, 12), // finished, 4 right, needs 6
    ]);
    await show();

    expect(screen.getByText("has not played yet")).toBeTruthy();
    expect(screen.getByText("stopped after 5 of 12 questions")).toBeTruthy();
    expect(screen.getByText(/got 4 right — needs 6/)).toBeTruthy();
    // and no download for any of them
    expect(screen.queryByRole("button", { name: "Certificate" })).toBeNull();
  });

  // A run saved before the units were joined into one game is a different set
  // of questions; counting it would hand out a certificate for a game nobody
  // played.
  it("ignores runs from the old per-unit boards", async () => {
    fetchPlayers.mockResolvedValue([player("p1", "Fai")]);
    fetchAttempts.mockResolvedValue([
      { ...run("p1", 12, 12), unit_id: "unit-01" },
    ]);
    await show();

    expect(screen.getByText("has not played yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Certificate" })).toBeNull();
  });
});
