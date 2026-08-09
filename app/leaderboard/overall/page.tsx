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
    <Shell active="ranking" kicker="All units · leaderboard">
      <main className="page">
        <header className="board-head">
          <div className="stack" style={{ gap: 6 }}>
            <span className="kicker">all units · leaderboard</span>
            <h1>Top explorers</h1>
          </div>

          {/* The only board switcher in the app. It says which board, and
              nothing else — Play lives in the bar above and does not need
              saying twice. */}
          <nav className="row row--tight no-print" aria-label="Which board">
            <span className="chip chip--pill chip--on">All units</span>
            {units.map((unit) => (
              <Link
                key={unit.id}
                className="chip chip--pill"
                href={`/leaderboard/${unit.id}`}
              >
                {unit.id.replace("-", " ")}
              </Link>
            ))}
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
