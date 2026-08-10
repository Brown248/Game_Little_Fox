// The game. One route, no segment, no query string — there is nothing to pick.
//
// This replaces /play/[unitId] (+ an optional ?part=N), which existed only so a
// child could be sent to one slice of the content. Both the unit picker and the
// part chooser are gone with it.

import PlayClient from "@/components/PlayClient";
import Shell from "@/components/Shell";
import { buildGame, GAME_ID } from "@/lib/game";

export const dynamic = "force-dynamic";

export default function PlayPage() {
  // No nav pills while a game is running: leaving is the Exit button's job,
  // and that one asks first.
  return (
    <Shell nav={false}>
      <PlayClient games={buildGame()} gameId={GAME_ID} />
    </Shell>
  );
}
