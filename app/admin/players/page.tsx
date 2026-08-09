// Explorer list: fix a mistyped name, merge duplicate records, and see at a
// glance who is behind and on which skill.

import MergePlayers from "@/components/admin/MergePlayers";
import PlayersTable from "@/components/admin/PlayersTable";
import { LoadFailed, ServiceKeyMissing } from "@/components/admin/SetupNotice";
import { fetchAttempts, fetchPlayers, summarisePlayers } from "@/lib/admin-data";
import { serviceConfigured } from "@/lib/supabase-admin";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  if (!serviceConfigured()) return <ServiceKeyMissing />;

  let summaries;
  try {
    const [players, attempts] = await Promise.all([fetchPlayers(), fetchAttempts()]);
    summaries = summarisePlayers(players, attempts);
  } catch (err) {
    return <LoadFailed error={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <div className="stack">
      <h1>Explorers ({summaries.length})</h1>
      <p className="muted">
        Accuracy is the same number the overall leaderboard shows: total score
        divided by total possible, across each explorer&apos;s best attempt per
        unit.
      </p>

      <PlayersTable summaries={summaries} totalUnits={listUnits().length} />

      <MergePlayers
        players={summaries.map((s) => ({
          id: s.player.id,
          name: s.player.name,
          attemptCount: s.attemptCount,
        }))}
      />
    </div>
  );
}
