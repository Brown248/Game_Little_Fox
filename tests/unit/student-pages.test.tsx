import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StartForm from "@/components/StartForm";
import { loadPlayer, savePlayer } from "@/lib/session";
import { routerMock } from "@/tests/setup";

const findOrCreatePlayer = vi.fn();

// The queries are stubbed but describeFailure/supabaseConfigured stay real, so
// the tests exercise the actual error classification the screens rely on.
vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  findOrCreatePlayer: (name: string) => findOrCreatePlayer(name),
  saveAttempt: vi.fn(),
}));

const NAME_LABEL = /type your name/i;
const START = { name: /^Play$/ };

beforeEach(() => {
  findOrCreatePlayer.mockReset().mockResolvedValue({
    id: "player-1",
    name: "Mint",
  });
});

describe("StartForm", () => {
  // The whole point of this screen: ONE question, asked once. The unit list
  // used to sit here too ("เข้าใจยากมาก"), and the instruction itself was
  // repeated four times over — heading, label, placeholder and a hint below.
  it("asks for a name and nothing else", () => {
    render(<StartForm questionCount={104} />);

    expect(screen.getByLabelText(NAME_LABEL)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    // said once, not four times over
    expect(screen.getAllByText(/type your name/i)).toHaveLength(1);
  });

  it("will not start until a name is typed", async () => {
    const user = userEvent.setup();
    render(<StartForm questionCount={104} />);

    expect(screen.getByRole("button", START)).toHaveProperty("disabled", true);

    await user.type(screen.getByLabelText(NAME_LABEL), "Mint");
    expect(screen.getByRole("button", START)).toHaveProperty("disabled", false);
  });

  it("resolves the player, stores the session and starts the game", async () => {
    const user = userEvent.setup();
    render(<StartForm questionCount={104} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "  Mint  ");
    await user.click(screen.getByRole("button", START));

    await waitFor(() => expect(findOrCreatePlayer).toHaveBeenCalledWith("Mint"));
    expect(loadPlayer()).toEqual({ id: "player-1", name: "Mint" });
    // straight into question one — there is nothing to choose
    expect(routerMock.push).toHaveBeenCalledWith("/play");
  });

  it("starts from the keyboard when Enter is pressed in the name field", async () => {
    const user = userEvent.setup();
    render(<StartForm questionCount={104} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "Mint{Enter}");

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/play"));
  });

  it("blames the connection only when the connection is the problem", async () => {
    findOrCreatePlayer.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<StartForm questionCount={104} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "Mint");
    await user.click(screen.getByRole("button", START));

    expect(await screen.findByText(/No internet/)).toBeTruthy();
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
    render(<StartForm questionCount={104} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "Mint");
    await user.click(screen.getByRole("button", START));

    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
    expect(screen.getByText(/42P01/)).toBeTruthy();
    expect(screen.getByText(/does not exist/)).toBeTruthy();
    expect(screen.queryByText(/No internet/)).toBeNull();
  });

  it("prefills a returning player's name", async () => {
    savePlayer({ id: "p", name: "Ploy" });
    render(<StartForm questionCount={104} />);

    await waitFor(() =>
      expect(screen.getByLabelText(NAME_LABEL)).toHaveProperty("value", "Ploy")
    );
  });
});
