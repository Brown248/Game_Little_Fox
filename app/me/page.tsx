// An explorer's own record: every run they have finished, and a way to get an
// earned certificate back without playing the unit again.
//
// The rows are fetched in the browser, because who "you" are lives in
// localStorage and the server never sees it. All this page does is hand down
// the unit titles, which come from JSON files read with fs.

import Link from "next/link";
import Shell from "@/components/Shell";
import MyScores from "@/components/MyScores";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default function MyScoresPage() {
  const unitTitles = Object.fromEntries(
    listUnits().map((unit) => [unit.id, unit.title])
  );

  return (
    // No tab of its own: the bar holds Play and Ranking only. This screen is
    // reached from the unit picker, the result screen and the footer.
    <Shell kicker="Your record">
      <main className="page">
        <header className="stack" style={{ gap: 8 }}>
          <span className="kicker">Your record</span>
          <h1>My scores</h1>
          <p className="lead">
            Every unit and part you have finished, newest first. Certificates
            you have earned can be downloaded again from here any time.
          </p>
        </header>

        <MyScores unitTitles={unitTitles} />

        <div className="row row--between no-print">
          <Link href="/units">← Play another unit</Link>
          <Link href="/leaderboard/overall">Top explorers →</Link>
        </div>
      </main>
    </Shell>
  );
}
