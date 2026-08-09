// Closes every student screen. Deliberately plain: one mono line about how the
// layout behaves and one sentence of housekeeping.
//
// It also carries the way to /me. That screen has no tab of its own, because
// the bar is down to Play and Ranking, but it must still be findable from
// anywhere — looking your own scores up again is exactly what the teacher
// asked for.

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="appfoot no-print">
      <div className="appfoot__in shell">
        <span className="kicker kicker--faint">
          Responsive · 360px → 1440px · fluid grid, no breakpoints
        </span>
        <span className="appfoot__note">
          Your name is your only login — use the same one every time.{" "}
          <Link href="/me">See my scores</Link>
        </span>
      </div>
    </footer>
  );
}
