import SiteFooter from "@/components/SiteFooter";
import SiteHeader, { type Tab } from "@/components/SiteHeader";

// header · <main class="page"> · footer, all sharing one 1240px measure.
// Every student screen renders through this; /admin keeps its own chrome
// because it is a teacher tool, not part of the expedition.

interface Props {
  children: React.ReactNode;
  kicker?: string;
  active?: Tab;
  nav?: boolean;
}

export default function Shell({ children, kicker, active, nav }: Props) {
  return (
    <div className="app">
      <SiteHeader kicker={kicker} active={active} nav={nav} />
      {children}
      <SiteFooter />
    </div>
  );
}
