// Reads getUnitRanking(id) from lib/supabase.ts and renders the board.
//
// The id is whatever an attempt was saved under: a unit ("unit-02") or a single
// part ("unit-02-part-3"). Both are ranked the same way and get their own page.

import Link from "next/link";
import Shell from "@/components/Shell";
import UnitLeaderboard from "@/components/UnitLeaderboard";
import { gameLabel, parsePartId, scoreIdLabel } from "@/lib/format";
import { getUnit } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function UnitLeaderboardPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  // Next 15: route params arrive as a promise. `unitId` here is a scoreboard
  // id, which may name a part.
  const { unitId: scoreId } = await params;
  const part = parsePartId(scoreId);
  const unit = getUnit(part ? part.unitId : scoreId);
  const label = scoreIdLabel(scoreId);

  const block = part ? unit?.games[part.partIndex] : undefined;
  const what = block
    ? `${unit!.title} · Part ${part!.partIndex + 1}, ${gameLabel(block.type)}`
    : (unit?.title ?? scoreId);

  return (
    <Shell
      active="unit"
      unitId={part ? part.unitId : scoreId}
      kicker={`${label} · leaderboard`}
    >
      <main className="page">
        <header className="board-head">
          <div className="stack" style={{ gap: 6 }}>
            <span className="kicker">{label} · leaderboard</span>
            <h1>Top explorers</h1>
          </div>

          <nav className="row row--tight no-print">
            <span className="chip chip--pill chip--on">
              {part ? "This part" : "This unit"}
            </span>
            {part && (
              <Link className="chip chip--pill" href={`/leaderboard/${part.unitId}`}>
                Whole unit
              </Link>
            )}
            <Link className="chip chip--pill" href="/leaderboard/overall">
              All units
            </Link>
            <Link className="chip chip--pill" href="/">
              Play
            </Link>
          </nav>
        </header>

        <p className="lead">
          {what} — each explorer&apos;s best attempt, highest score first,
          fastest time breaks a tie.
        </p>

        <UnitLeaderboard unitId={scoreId} />
      </main>
    </Shell>
  );
}
