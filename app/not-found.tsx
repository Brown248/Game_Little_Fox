import Image from "next/image";
import Link from "next/link";
import Shell from "@/components/Shell";

export default function NotFound() {
  return (
    <Shell kicker="Off the map">
      <main className="page page--narrow">
        <div className="hero">
          <Image
            className="logo logo--sm"
            src="/little-fox-logo.png"
            alt=""
            width={208}
            height={208}
          />
          <h1>Off the map</h1>
          <p className="muted">
            This page or unit doesn&apos;t exist. A unit only appears once its
            JSON file is in <code>content/units/</code>.
          </p>
          <Link href="/">← Back to the start</Link>
        </div>
      </main>
    </Shell>
  );
}
