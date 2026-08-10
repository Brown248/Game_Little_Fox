// Explorer list: fix a mistyped name, merge duplicate records, and see at a
// glance who has their certificate and who is behind on which skill.

import MergePlayers from "@/components/admin/MergePlayers";
import PlayersTable from "@/components/admin/PlayersTable";
import { LoadFailed, ServiceKeyMissing } from "@/components/admin/SetupNotice";
import {
  certificateRoster,
  fetchAttempts,
  fetchPlayers,
  summarisePlayers,
} from "@/lib/admin-data";
import { GAME_ID, fullQuestionCount } from "@/lib/game";
import { serviceConfigured } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  if (!serviceConfigured()) return <ServiceKeyMissing />;

  let summaries;
  let certifiedIds: string[] = [];
  try {
    const [players, attempts] = await Promise.all([fetchPlayers(), fetchAttempts()]);
    summaries = summarisePlayers(players, attempts);
    certifiedIds = certificateRoster(players, attempts, GAME_ID, fullQuestionCount())
      .filter((row) => row.state === "earned")
      .map((row) => row.player.id);
  } catch (err) {
    return <LoadFailed error={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <div className="stack">
      <div className="adminhead">
        <h1>Explorers</h1>
        <span className="adminhead__count">{summaries.length}</span>
      </div>
      <p className="muted">
        Tap a name to see every run. Accuracy is score divided by total
        possible, across each explorer&apos;s best run.
      </p>

      <PlayersTable summaries={summaries} certifiedIds={certifiedIds} />

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
