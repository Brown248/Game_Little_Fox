import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverallLeaderboard from "@/components/OverallLeaderboard";
import StartForm from "@/components/StartForm";
import UnitLeaderboard from "@/components/UnitLeaderboard";
import { loadPlayer, savePlayer } from "@/lib/session";
import { routerMock } from "@/tests/setup";

const findOrCreatePlayer = vi.fn();
const getUnitRanking = vi.fn();
const getOverallRanking = vi.fn();

// The queries are stubbed but describeFailure/supabaseConfigured stay real, so
// the tests exercise the actual error classification the screens rely on.
vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  findOrCreatePlayer: (name: string) => findOrCreatePlayer(name),
  getUnitRanking: (unitId: string) => getUnitRanking(unitId),
  getOverallRanking: () => getOverallRanking(),
  saveAttempt: vi.fn(),
}));

const UNITS = [
  {
    id: "unit-02",
    title: "Wild Life and Wonderful Creatures",
    gameCount: 4,
    questionCount: 19,
    maxScore: 190,
  },
  {
    id: "unit-03",
    title: "Ocean Friends",
    gameCount: 2,
    questionCount: 8,
    maxScore: 80,
  },
];

const NAME_LABEL = /explorer name/i;
const START = { name: /^Start$/ };

beforeEach(() => {
  findOrCreatePlayer.mockReset().mockResolvedValue({
    id: "player-1",
    name: "Mint",
  });
  getUnitRanking.mockReset().mockResolvedValue([]);
  getOverallRanking.mockReset().mockResolvedValue([]);
});

describe("StartForm", () => {
  // The whole point of this screen after the first lesson: ONE question. The
  // unit list used to sit here too, and the teacher's verdict on arriving to
  // both at once was "เข้าใจยากมาก".
  it("asks for a name and nothing else", () => {
    render(<StartForm unitCount={UNITS.length} />);

    expect(screen.getByLabelText(NAME_LABEL)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/class/i)).toBeNull();
    // no unit anywhere on the first screen
    expect(screen.queryByText("Wild Life and Wonderful Creatures")).toBeNull();
    expect(screen.queryByText("Ocean Friends")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("will not start until a name is typed", async () => {
    const user = userEvent.setup();
    render(<StartForm unitCount={UNITS.length} />);

    expect(screen.getByRole("button", START)).toHaveProperty("disabled", true);
    expect(screen.getByText(/Type your name above/)).toBeTruthy();

    await user.type(screen.getByLabelText(NAME_LABEL), "Mint");
    expect(screen.getByRole("button", START)).toHaveProperty("disabled", false);
    expect(screen.getByText(/pick one of 2 units/)).toBeTruthy();
  });

  it("resolves the player, stores the session and opens the unit picker", async () => {
    const user = userEvent.setup();
    render(<StartForm unitCount={UNITS.length} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "  Mint  ");
    await user.click(screen.getByRole("button", START));

    await waitFor(() => expect(findOrCreatePlayer).toHaveBeenCalledWith("Mint"));
    expect(loadPlayer()).toEqual({ id: "player-1", name: "Mint" });
    // choosing happens on the next screen, one decision at a time
    expect(routerMock.push).toHaveBeenCalledWith("/units");
  });

  it("starts from the keyboard when Enter is pressed in the name field", async () => {
    const user = userEvent.setup();
    render(<StartForm unitCount={UNITS.length} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "Mint{Enter}");

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/units"));
  });

  it("blames the connection only when the connection is the problem", async () => {
    findOrCreatePlayer.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<StartForm unitCount={UNITS.length} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "Mint");
    await user.click(screen.getByRole("button", START));

    expect(await screen.findByText(/Could not reach the scoreboard/)).toBeTruthy();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(loadPlayer()).toBeNull();
  });

  // Supabase rejects with a plain object that console.error prints as `{}`;
  // the reason has to reach the screen or nobody can act on it.
  it("shows the database's own reason when the scoreboard refuses", async () => {
    findOrCreatePlayer.mockRejectedValue({
      message: 'relation "public.players" does not exist',
      code: "42P01",
    });
    const user = userEvent.setup();
    render(<StartForm unitCount={UNITS.length} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "Mint");
    await user.click(screen.getByRole("button", START));

    expect(await screen.findByText(/would not accept that/)).toBeTruthy();
    expect(screen.getByText(/42P01/)).toBeTruthy();
    expect(screen.getByText(/does not exist/)).toBeTruthy();
    expect(screen.queryByText(/Could not reach the scoreboard/)).toBeNull();
  });

  it("prefills a returning explorer's name", async () => {
    savePlayer({ id: "p", name: "Ploy" });
    render(<StartForm unitCount={UNITS.length} />);

    await waitFor(() =>
      expect(screen.getByLabelText(NAME_LABEL)).toHaveProperty("value", "Ploy")
    );
  });
});

describe("UnitLeaderboard", () => {
  const rows = [
    { player_id: "p1", name: "Ann", unit_id: "unit-02", score: 60, max_score: 60, time_seconds: 300, completed_at: "" },
    { player_id: "p2", name: "Ben", unit_id: "unit-02", score: 60, max_score: 60, time_seconds: 400, completed_at: "" },
    { player_id: "p3", name: "Cat", unit_id: "unit-02", score: 10, max_score: 60, time_seconds: 20, completed_at: "" },
  ];

  const names = () =>
    screen
      .getAllByRole("listitem")
      .map((row) => row.querySelector(".board__name")?.textContent);

  it("renders the board in the exact order the query returned", async () => {
    getUnitRanking.mockResolvedValue(rows);
    render(<UnitLeaderboard unitId="unit-02" />);

    // findAllByText, not findByText: the top three also appear on the podium.
    await screen.findAllByText("Ann");
    // Cat has the fastest time but the lowest score: a client-side re-sort
    // would move her up, and that would silently break the ranking rules.
    expect(names()).toEqual(["Ann", "Ben", "Cat"]);
    expect(screen.getAllByText(/5:00/).length).toBeGreaterThan(0);
  });

  it("gives the top three the marigold place disc", async () => {
    getUnitRanking.mockResolvedValue(rows);
    render(<UnitLeaderboard unitId="unit-02" />);
    // findAllByText, not findByText: the top three also appear on the podium.
    await screen.findAllByText("Ann");

    const discs = screen
      .getAllByRole("listitem")
      .map((row) => row.querySelector(".board__place")?.className ?? "");
    expect(discs.filter((c) => c.includes("board__place--top"))).toHaveLength(3);
  });

  it("marks the row of the explorer using this device", async () => {
    getUnitRanking.mockResolvedValue(rows);
    savePlayer({ id: "p2", name: "Ben" });
    render(<UnitLeaderboard unitId="unit-02" />);

    await screen.findAllByText("Ben");
    const mine = screen
      .getAllByRole("listitem")
      .filter((row) => row.className.includes("board__row--me"));
    expect(mine).toHaveLength(1);
    expect(mine[0].textContent).toContain("Ben");
    expect(mine[0].textContent).toContain("YOU");
  });

  it("invites the first player when nobody has finished", async () => {
    getUnitRanking.mockResolvedValue([]);
    render(<UnitLeaderboard unitId="unit-02" />);
    expect(await screen.findByText(/Be the first/)).toBeTruthy();
  });

  it("offers a retry when the query fails", async () => {
    getUnitRanking.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<UnitLeaderboard unitId="unit-02" />);

    expect(await screen.findByText(/Could not reach the scoreboard/)).toBeTruthy();
    getUnitRanking.mockResolvedValue(rows);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByText("Ann")).not.toHaveLength(0);
  });

  it("re-queries on demand", async () => {
    getUnitRanking.mockResolvedValue(rows);
    const user = userEvent.setup();
    render(<UnitLeaderboard unitId="unit-02" />);
    // findAllByText, not findByText: the top three also appear on the podium.
    await screen.findAllByText("Ann");

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(getUnitRanking).toHaveBeenCalledTimes(2));
  });
});

describe("OverallLeaderboard", () => {
  const rows = [
    { player_id: "p1", name: "Ann", overall_accuracy: 0.9, units_completed: 3 },
    { player_id: "p2", name: "Ben", overall_accuracy: 0.85, units_completed: 20 },
    { player_id: "p3", name: "Cat", overall_accuracy: null, units_completed: 0 },
  ];

  const names = () =>
    screen
      .getAllByRole("listitem")
      .map((row) => row.querySelector(".board__name")?.textContent);

  it("shows accuracy as a percentage alongside units played", async () => {
    getOverallRanking.mockResolvedValue(rows);
    render(<OverallLeaderboard totalUnits={20} />);

    // findAllByText, not findByText: the top three also appear on the podium.
    await screen.findAllByText("Ann");
    expect(screen.getAllByText("90%").length).toBeGreaterThan(0);
    expect(screen.getByText(/3 \/ 20 units played/)).toBeTruthy();
    expect(screen.getByText(/20 \/ 20 units played/)).toBeTruthy();
    // a player with no scored attempts must not read as 0% or 100%
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("explains that the ranking is accuracy, not total score", async () => {
    getOverallRanking.mockResolvedValue(rows);
    render(<OverallLeaderboard totalUnits={20} />);
    // findAllByText, not findByText: the top three also appear on the podium.
    await screen.findAllByText("Ann");
    expect(screen.getByText(/not ahead of one averaging/)).toBeTruthy();
  });

  it("preserves the query order", async () => {
    getOverallRanking.mockResolvedValue(rows);
    render(<OverallLeaderboard totalUnits={20} />);
    // findAllByText, not findByText: the top three also appear on the podium.
    await screen.findAllByText("Ann");
    expect(names()).toEqual(["Ann", "Ben", "Cat"]);
  });

  it("handles an empty board and a failure", async () => {
    getOverallRanking.mockResolvedValue([]);
    const { unmount } = render(<OverallLeaderboard totalUnits={20} />);
    expect(await screen.findByText(/No attempts yet/)).toBeTruthy();
    unmount();

    getOverallRanking.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<OverallLeaderboard totalUnits={20} />);
    expect(await screen.findByText(/Could not reach the scoreboard/)).toBeTruthy();
  });
});
