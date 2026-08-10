// Kept only so old links and bookmarks land somewhere sensible.
//
// There is one board now, at /rank. This route used to hold the accuracy-
// weighted "across all units" ranking, which stopped meaning anything the
// moment the game stopped being divided into units.

import { redirect } from "next/navigation";

export default function OverallLeaderboardPage() {
  redirect("/rank");
}
