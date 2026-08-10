// An explorer's own record: every run they have finished, and a way to get an
// earned certificate back without playing the unit again.
//
// The rows are fetched in the browser, because who "you" are lives in
// localStorage and the server never sees it. All this page does is hand down
// the unit titles, which come from JSON files read with fs.

import Shell from "@/components/Shell";
import MyScores from "@/components/MyScores";
import { fullQuestionCount, GAME_ID } from "@/lib/game";
import { SITE_NAME } from "@/lib/site";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default function MyScoresPage() {
  // Runs of the game, plus the unit-by-unit runs from before it was joined
  // into one — those rows are still in the database and still a child's own
  // history, so they keep their real titles rather than showing a bare id.
  const unitTitles = {
    ...Object.fromEntries(listUnits().map((unit) => [unit.id, unit.title])),
    [GAME_ID]: SITE_NAME,
  };

  return (
    // No tab of its own: the bar holds Play and Ranking only. This screen is
    // reached from the unit picker, the result screen and the footer.
    <Shell kicker="Your record">
      <main className="page">
        <h1>My scores</h1>

        <MyScores
          unitTitles={unitTitles}
          gameId={GAME_ID}
          fullQuestionCount={fullQuestionCount()}
        />
      </main>
    </Shell>
  );
}
