// The QR code students scan. Generated on the server with no external service,
// so it works offline and nothing about the class leaks to a third party.

import Image from "next/image";
import { headers } from "next/headers";
import QRCode from "qrcode";
import PrintButton from "@/components/admin/PrintButton";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function AdminQrPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>;
}) {
  const { target } = await searchParams;
  const base = await resolveBaseUrl();
  const url = target ? `${base}${target}` : base;
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });

  const units = listUnits();

  return (
    <div className="stack">
      <h1>QR code</h1>
      <p className="muted">
        Print this and stick it on the wall. It points at the site root, so it
        keeps working as units are added — the QR never has to be reprinted.
      </p>

      <div className="card center print-area">
        {/* the poster is what a child sees before the site does any talking, so
            it leads with the logo rather than a heading */}
        <Image
          src="/little-fox-logo.png"
          alt="Little Fox Language School"
          width={160}
          height={160}
          style={{ margin: "0 auto", height: "auto" }}
        />
        <h2>Little Fox Game</h2>
        <div
          aria-label={`QR code for ${url}`}
          // SVG generated locally by qrcode, no user input
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{ maxWidth: 320, margin: "0 auto" }}
        />
        <p style={{ wordBreak: "break-all" }}>
          <code>{url}</code>
        </p>
      </div>

      <div className="row no-print">
        <PrintButton />
      </div>

      {!process.env.NEXT_PUBLIC_SITE_URL && (
        <div className="notice no-print">
          <strong>Using the current host.</strong> Set{" "}
          <code>NEXT_PUBLIC_SITE_URL</code> in your environment (e.g. the Vercel
          URL) before printing, or the code will point at whatever address you
          happen to be viewing this page on.
        </div>
      )}

      <div className="card no-print">
        <h2>Direct links</h2>
        <p className="muted">
          A QR for a single unit if you ever want one — students normally start at
          the root and pick their unit there.
        </p>
        <div className="breakdown">
          {units.map((unit) => (
            <div className="breakdown__row" key={unit.id}>
              <span>{unit.title}</span>
              <a href={`/admin/qr?target=/play/${unit.id}`}>
                QR for /play/{unit.id}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function resolveBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}
