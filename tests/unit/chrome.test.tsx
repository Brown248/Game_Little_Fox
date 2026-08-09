import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SiteHeader from "@/components/SiteHeader";

// The bar is two tabs and it stays two tabs.
//
// It grew to Play · This unit · My scores · Top explorers while the board
// screens carried a row of chips offering the same choices again. Seeing it on
// a phone, the teacher's note was that a tab to play and a tab for the ranking
// is the whole requirement — the rest was the same thing said three times.
describe("the app bar", () => {
  const tabs = () =>
    within(screen.getByRole("navigation", { name: "Screens" })).getAllByRole(
      "link"
    );

  it("offers playing and the ranking, and nothing else", () => {
    render(<SiteHeader active="start" />);

    expect(tabs().map((tab) => tab.textContent)).toEqual(["Play", "Ranking"]);
  });

  it("marks which of the two you are on", () => {
    render(<SiteHeader active="ranking" />);

    const [play, ranking] = tabs();
    expect(play.className).not.toContain("tab--on");
    expect(ranking.className).toContain("tab--on");
    expect(ranking.getAttribute("href")).toBe("/leaderboard/overall");
  });

  // A stray tap on a tab mid-question would throw the run away; /play asks
  // before leaving, and the way it guarantees that is by having no tabs.
  it("hides the tabs entirely during a run", () => {
    render(<SiteHeader nav={false} />);

    expect(screen.queryByRole("navigation", { name: "Screens" })).toBeNull();
  });
});
