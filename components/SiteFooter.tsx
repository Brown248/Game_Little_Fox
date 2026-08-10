// Closes every student screen, and holds exactly one thing: the way to /me.
//
// That screen has no tab of its own — the bar is down to Play and Top scores —
// but it must still be reachable from anywhere, because looking your own scores
// up again is exactly what the teacher asked for.
//
// What used to be here: a mono line reading "Responsive · 360px → 1440px ·
// fluid grid, no breakpoints", printed under every screen a nine-year-old ever
// saw, and a sentence about logins that the first screen already said.

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="appfoot no-print">
      <div className="appfoot__in shell">
        <Link className="textlink" href="/me">
          My scores
        </Link>
      </div>
    </footer>
  );
}
