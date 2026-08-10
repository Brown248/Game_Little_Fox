// The ranking, and the end of every run.
//
// A finished game replaces its own history entry with this page, so pressing
// back here goes to the name screen rather than walking into the game again —
// "เวลาอยู่หน้าโชว์แรงค์ พอกดย้อนกลับควรไปหน้าเริ่มต้นเลยคือหน้าใส่ชื่อ".

import Link from "next/link";
import RankBoard from "@/components/RankBoard";
import Shell from "@/components/Shell";
import { fullQuestionCount, GAME_ID } from "@/lib/game";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function RankPage() {
  return (
    <Shell active="ranking" kicker="Top scores">
      <main className="page">
        {/* A trophy reads before the words do, which is the point on a screen
            made for children still learning to read the words. */}
        <h1 className="board-title">
          <span aria-hidden="true">🏆</span> Top scores
        </h1>
        <RankBoard
          gameId={GAME_ID}
          gameTitle={SITE_NAME}
          fullQuestionCount={fullQuestionCount()}
        />
        <div className="row row--between no-print">
          <Link className="textlink" href="/">
            Back to the start
          </Link>
        </div>
      </main>
    </Shell>
  );
}
