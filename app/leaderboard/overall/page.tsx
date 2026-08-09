// Reads getOverallRanking() from lib/supabase.ts — accuracy-weighted,
// not a raw score sum, so units with more questions don't dominate.

import Link from "next/link";
import OverallLeaderboard from "@/components/OverallLeaderboard";
import Shell from "@/components/Shell";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default function OverallLeaderboardPage() {
  const units = listUnits();

  return (
    <Shell
      active="overall"
      unitId={units[0]?.id}
      kicker="All units · leaderboard"
    >
      <main className="page">
        <header className="board-head">
          <div className="stack" style={{ gap: 6 }}>
            <span className="kicker">all units · leaderboard</span>
            <h1>Top explorers</h1>
          </div>

          <nav className="row row--tight no-print">
            <span className="chip chip--pill chip--on">All units</span>
            {units[0] && (
              <Link
                className="chip chip--pill"
                href={`/leaderboard/${units[0].id}`}
              >
                {units[0].id.replace("-", " ")}
              </Link>
            )}
            <Link className="chip chip--pill" href="/">
              Play
            </Link>
          </nav>
        </header>

        <p className="lead">
          Ranked by average accuracy across each explorer&apos;s best attempt per
          unit — not by total score, so longer units don&apos;t dominate.
        </p>

        <OverallLeaderboard totalUnits={units.length} />
      </main>
    </Shell>
  );
}
