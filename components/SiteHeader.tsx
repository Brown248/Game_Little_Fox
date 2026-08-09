import Image from "next/image";
import Link from "next/link";

// The sticky bar at the top of every student screen: compass mark, the app
// name with a mono line underneath, and the screen tabs on the right.
// Server component on purpose — the active tab is passed in rather than read
// from usePathname, so no page has to become a client component for chrome.

export type Tab = "start" | "unit" | "overall";

interface Props {
  /** Mono line under the wordmark, e.g. "UNIT 02 · WILD LIFE". */
  kicker?: string;
  active?: Tab;
  /** Unit board to link to; omitted when no unit is in play. */
  unitId?: string;
  /** Hidden mid-expedition so a stray tap can't throw the run away. */
  nav?: boolean;
}

export default function SiteHeader({
  kicker = "A ranked English expedition",
  active,
  unitId,
  nav = true,
}: Props) {
  return (
    <header className="appbar no-print">
      <div className="appbar__in shell">
        <Link className="brand" href="/">
          {/* the simplified mark, not the full lockup: at 44px the school name
              under the fox turns to mush */}
          <Image
            className="brand__mark"
            src="/little-fox-mark.png"
            alt=""
            width={44}
            height={44}
            priority
          />
          <span className="brand__text">
            <span className="brand__name">Little Fox Game</span>
            <span className="brand__meta">{kicker}</span>
          </span>
        </Link>

        {nav && (
          <nav className="tabs" aria-label="Screens">
            <Link
              className={`tab${active === "start" ? " tab--on" : ""}`}
              href="/"
            >
              Play
            </Link>
            {unitId && (
              <Link
                className={`tab${active === "unit" ? " tab--on" : ""}`}
                href={`/leaderboard/${unitId}`}
              >
                This unit
              </Link>
            )}
            <Link
              className={`tab${active === "overall" ? " tab--on" : ""}`}
              href="/leaderboard/overall"
            >
              Top explorers
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
