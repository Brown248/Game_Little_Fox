// Landing page: the expedition pitch on one side, the card a student types
// into on the other. The unit list comes from whatever JSON files exist in
// content/units/, so a new unit shows up here with no code change.

import Shell from "@/components/Shell";
import StartForm from "@/components/StartForm";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const units = listUnits();
  const questions = units.reduce((total, unit) => total + unit.questionCount, 0);
  const points = units.reduce((total, unit) => total + unit.maxScore, 0);

  return (
    <Shell active="start" unitId={units[0]?.id}>
      <main className="page">
        <div className="split split--hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span>Expedition open</span>
            </span>

            <h1 className="display">Ready for today&apos;s expedition?</h1>

            <p className="lead">
              Learn animal words in English by playing. Type your name, pick a
              unit, and every answer you get right puts you higher on the class
              leaderboard.
            </p>

            <div className="facts">
              <span className="fact">
                <span>
                  <strong>
                    {units.length} unit{units.length === 1 ? "" : "s"}
                  </strong>
                  <br />
                  ready to play
                </span>
              </span>
              <span className="fact">
                <span>
                  <strong>{questions} questions</strong>
                  <br />
                  worth {points} points
                </span>
              </span>
              <span className="fact">
                <span>
                  <strong>No password</strong>
                  <br />
                  just your name
                </span>
              </span>
            </div>
          </div>

          <StartForm units={units} />
        </div>
      </main>
    </Shell>
  );
}
