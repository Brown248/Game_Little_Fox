// The door. One question, one button, nothing to read.
//
// It used to open with an eyebrow, a display heading, a 24-word paragraph and
// three fact chips before the name field — 118 words, and on a 360px phone the
// field itself landed around y=757, below the fold. The teacher's ask was
// "เข้าหน้าเว็ปมาก็คือใส่ชื่อได้เลย", so everything that was not the name field
// is gone and the card is the whole page.

import Shell from "@/components/Shell";
import StartForm from "@/components/StartForm";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const questions = listUnits().reduce(
    (total, unit) => total + unit.questionCount,
    0
  );

  return (
    <Shell active="start">
      <main className="page page--door">
        <StartForm questionCount={questions} />
      </main>
    </Shell>
  );
}
