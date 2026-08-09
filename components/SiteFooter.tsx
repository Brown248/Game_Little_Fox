// Closes every student screen. Deliberately plain: one mono line about how the
// layout behaves and one sentence of housekeeping.

export default function SiteFooter() {
  return (
    <footer className="appfoot no-print">
      <div className="appfoot__in shell">
        <span className="kicker kicker--faint">
          Responsive · 360px → 1440px · fluid grid, no breakpoints
        </span>
        <span className="appfoot__note">
          Your name is your only login — use the same one every time.
        </span>
      </div>
    </footer>
  );
}
