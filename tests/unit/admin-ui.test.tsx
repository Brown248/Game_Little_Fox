import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminLogin from "@/components/admin/AdminLogin";
import AttemptsTable from "@/components/admin/AttemptsTable";
import MergePlayers from "@/components/admin/MergePlayers";
import PlayersTable from "@/components/admin/PlayersTable";
import type { AttemptWithPlayer, PlayerSummary } from "@/lib/types";
import { routerMock } from "@/tests/setup";

const loginAction = vi.fn();
const renamePlayerAction = vi.fn();
const deletePlayerAction = vi.fn();
const mergePlayersAction = vi.fn();
const deleteAttemptAction = vi.fn();

vi.mock("@/app/admin/actions", () => ({
  loginAction: (...args: unknown[]) => loginAction(...args),
  logoutAction: vi.fn(async () => ({ ok: true })),
  renamePlayerAction: (...args: unknown[]) => renamePlayerAction(...args),
  deletePlayerAction: (...args: unknown[]) => deletePlayerAction(...args),
  mergePlayersAction: (...args: unknown[]) => mergePlayersAction(...args),
  deleteAttemptAction: (...args: unknown[]) => deleteAttemptAction(...args),
}));

const summary: PlayerSummary = {
  player: { id: "p1", name: "Mint", created_at: "2026-01-01T00:00:00.000Z" },
  attemptCount: 4,
  unitsPlayed: 2,
  accuracy: 0.75,
  bestScoreTotal: 90,
  maxScoreTotal: 120,
  totalTimeSeconds: 600,
  lastPlayedAt: "2026-03-01T09:00:00.000Z",
  skills: [
    { gameType: "listening", correct: 1, total: 6 },
    { gameType: "unscramble", correct: 8, total: 10 },
  ],
  weakestSkill: { gameType: "listening", correct: 1, total: 6 },
};

const attempt: AttemptWithPlayer = {
  id: "a1",
  player_id: "p1",
  unit_id: "unit-02",
  score: 40,
  max_score: 60,
  correct_count: 4,
  total_questions: 6,
  time_seconds: 90,
  completed_at: "2026-03-01T09:00:00.000Z",
  game_type_breakdown: { listening: { correct: 0, total: 1 } },
  players: { name: "Mint" },
};

beforeEach(() => {
  loginAction.mockReset().mockResolvedValue({ ok: true });
  renamePlayerAction.mockReset().mockResolvedValue({ ok: true });
  deletePlayerAction.mockReset().mockResolvedValue({ ok: true });
  mergePlayersAction.mockReset().mockResolvedValue({ ok: true });
  deleteAttemptAction.mockReset().mockResolvedValue({ ok: true });
});

describe("AdminLogin", () => {
  it("blocks sign-in and explains when no password is configured", () => {
    render(<AdminLogin configured={false} />);
    expect(screen.getByText(/ADMIN_PASSWORD is not set/)).toBeTruthy();
    expect(screen.getByLabelText("Password")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("uses a password field, not a text field", () => {
    render(<AdminLogin configured />);
    expect(screen.getByLabelText("Password")).toHaveProperty("type", "password");
  });

  it("refreshes the page on success so the gate re-runs on the server", async () => {
    const user = userEvent.setup();
    render(<AdminLogin configured />);

    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(loginAction).toHaveBeenCalledWith("secret"));
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("shows the server's reason on failure and does not refresh", async () => {
    loginAction.mockResolvedValue({ ok: false, error: "Wrong password." });
    const user = userEvent.setup();
    render(<AdminLogin configured />);

    await user.type(screen.getByLabelText("Password"), "nope");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Wrong password.")).toBeTruthy();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });
});

describe("PlayersTable", () => {
  it("shows accuracy, attempts and the weakest skill", () => {
    render(<PlayersTable summaries={[summary]} certifiedIds={[]} />);
    expect(screen.getByText("Mint")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText(/Listening/)).toBeTruthy();
    expect(screen.getByText(/\(17%\)/)).toBeTruthy();
  });

  // The column the teacher actually scans down. It is a plain yes/no because
  // the reason a student has not earned one belongs on the certificates page,
  // where there is room to say it.
  it("ticks the explorers who have a certificate", () => {
    render(<PlayersTable summaries={[summary]} certifiedIds={["p1"]} />);
    expect(screen.getByText("earned")).toBeTruthy();
  });

  it("leaves the certificate blank for everyone else", () => {
    render(<PlayersTable summaries={[summary]} certifiedIds={["someone-else"]} />);
    expect(screen.queryByText("earned")).toBeNull();
  });

  it("says when there is not enough data to name a weakest skill", () => {
    render(
      <PlayersTable
        summaries={[{ ...summary, weakestSkill: null }]}
        certifiedIds={[]}
      />
    );
    expect(screen.getByText("not enough data")).toBeTruthy();
  });

  it("says when there are no explorers", () => {
    render(<PlayersTable summaries={[]} certifiedIds={[]} />);
    expect(screen.getByText(/No explorers yet/)).toBeTruthy();
  });

  it("has no class field to edit — the name is the whole identity", async () => {
    const user = userEvent.setup();
    render(<PlayersTable summaries={[summary]} certifiedIds={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByLabelText("Class")).toBeNull();
  });

  it("saves a corrected name", async () => {
    const user = userEvent.setup();
    render(<PlayersTable summaries={[summary]} certifiedIds={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Mint Suwan");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(renamePlayerAction).toHaveBeenCalledWith("p1", "Mint Suwan")
    );
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("surfaces a duplicate-name error and stays in edit mode", async () => {
    renamePlayerAction.mockResolvedValue({
      ok: false,
      error: "Another explorer already uses that name — merge them instead.",
    });
    const user = userEvent.setup();
    render(<PlayersTable summaries={[summary]} certifiedIds={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/merge them instead/)).toBeTruthy();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("asks before deleting an explorer and mentions how much is lost", async () => {
    const user = userEvent.setup();
    render(<PlayersTable summaries={[summary]} certifiedIds={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // the question names the student and the cost, and nothing has happened yet
    expect(screen.getByText("Delete Mint?")).toBeTruthy();
    expect(screen.getByText(/All 4 of their attempts go too/)).toBeTruthy();
    expect(deletePlayerAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep them" }));
    expect(deletePlayerAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete them" }));
    await waitFor(() => expect(deletePlayerAction).toHaveBeenCalledWith("p1"));
  });

  it("cancels an edit without calling the server", async () => {
    const user = userEvent.setup();
    render(<PlayersTable summaries={[summary]} certifiedIds={[]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(renamePlayerAction).not.toHaveBeenCalled();
  });
});

describe("MergePlayers", () => {
  const players = [
    { id: "p1", name: "Mint", attemptCount: 4 },
    { id: "p2", name: "mint", attemptCount: 1 },
  ];

  it("needs both records chosen before merging", async () => {
    const user = userEvent.setup();
    render(<MergePlayers players={players} />);

    const button = screen.getByRole("button", { name: "Merge" });
    expect(button).toHaveProperty("disabled", true);

    await user.selectOptions(screen.getByLabelText("Duplicate to remove"), "p2");
    expect(button).toHaveProperty("disabled", true);

    await user.selectOptions(screen.getByLabelText("Record to keep"), "p1");
    expect(button).toHaveProperty("disabled", false);
  });

  it("cannot merge a record into itself", async () => {
    const user = userEvent.setup();
    render(<MergePlayers players={players} />);

    await user.selectOptions(screen.getByLabelText("Duplicate to remove"), "p1");
    const keep = screen.getByLabelText("Record to keep") as HTMLSelectElement;
    const values = [...keep.options].map((o) => o.value);
    expect(values).not.toContain("p1");
  });

  /** Picks both records and opens the question. */
  async function askToMerge(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(screen.getByLabelText("Duplicate to remove"), "p2");
    await user.selectOptions(screen.getByLabelText("Record to keep"), "p1");
    await user.click(screen.getByRole("button", { name: "Merge" }));
  }

  it("confirms with the number of attempts being moved, then merges", async () => {
    const user = userEvent.setup();
    render(<MergePlayers players={players} />);

    await askToMerge(user);
    expect(screen.getByText(/1 attempt\(s\) move from "mint" onto "Mint"/)).toBeTruthy();
    expect(mergePlayersAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Merge them" }));
    await waitFor(() => expect(mergePlayersAction).toHaveBeenCalledWith("p2", "p1"));
    expect(await screen.findByText("Merged.")).toBeTruthy();
  });

  it("does nothing when the question is declined", async () => {
    const user = userEvent.setup();
    render(<MergePlayers players={players} />);

    await askToMerge(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mergePlayersAction).not.toHaveBeenCalled();
  });

  it("reports a server-side failure", async () => {
    mergePlayersAction.mockResolvedValue({ ok: false, error: "Not authorised" });
    const user = userEvent.setup();
    render(<MergePlayers players={players} />);

    await askToMerge(user);
    await user.click(screen.getByRole("button", { name: "Merge them" }));

    expect(await screen.findByText("Not authorised")).toBeTruthy();
  });
});

describe("AttemptsTable", () => {
  it("shows the attempt with its accuracy and time", () => {
    render(<AttemptsTable attempts={[attempt]} showPlayer />);
    expect(screen.getByText("unit-02")).toBeTruthy();
    expect(screen.getByText("40 / 60")).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("1:30")).toBeTruthy();
    expect(screen.getByText("Mint")).toBeTruthy();
  });

  it("hides the student column when asked", () => {
    render(<AttemptsTable attempts={[attempt]} />);
    expect(screen.queryByText("Mint")).toBeNull();
  });

  it("warns that attempts are meant to be kept before deleting one", async () => {
    const user = userEvent.setup();
    render(<AttemptsTable attempts={[attempt]} showPlayer />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/meant to be kept/)).toBeTruthy();
    expect(deleteAttemptAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(deleteAttemptAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete it" }));
    await waitFor(() => expect(deleteAttemptAction).toHaveBeenCalledWith("a1"));
  });

  it("says when there is nothing to show", () => {
    render(<AttemptsTable attempts={[]} />);
    expect(screen.getByText("No attempts yet.")).toBeTruthy();
  });

  it("copes with an attempt whose player row is gone", () => {
    render(<AttemptsTable attempts={[{ ...attempt, players: null }]} showPlayer />);
    expect(screen.getByText("(deleted)")).toBeTruthy();
  });
});
