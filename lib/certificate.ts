// Client-side PDF certificate — landscape A5, built to the visual direction:
// white card, marigold rule, dashed kraft inner frame and the explorer's name
// in deep orange.
//
// The school logo is the ONLY emblem on the page. There used to be a second
// one — a compass rosette stamped on the right, left over from the old brand —
// and two marks competing on one certificate is one too many. Keep it that way:
// no badges, no seals, no extra artwork.
//
// jspdf is imported lazily so it only reaches the browser when a student
// actually taps "download" — it never lands in the bundle for the landing page
// or the leaderboards. The logo is fetched at the same moment for the same
// reason: 124KB of PNG has no business in the landing page's payload.

import { formatDate, formatPercent, formatTime } from "./format";

export interface CertificateData {
  name: string;
  unitId: string;
  unitTitle: string;
  score: number;
  maxScore: number;
  timeSeconds: number;
  accuracy: number; // 0..1
  /** e.g. "3 / 24" — omitted when the leaderboard could not be read. */
  rankLabel?: string;
}

const MARIGOLD: [number, number, number] = [242, 140, 40];
const DEEP: [number, number, number] = [196, 96, 15];
const KRAFT: [number, number, number] = [226, 205, 174];
const EDGE: [number, number, number] = [243, 228, 206];
const INK: [number, number, number] = [46, 42, 38];
const INK_SOFT: [number, number, number] = [107, 97, 85];

/** Where the logo sits on the page, in mm. The block below it is laid out
 *  against these numbers, so the page keeps its shape even when the artwork
 *  could not be fetched — a missing logo leaves air, never a shunted layout. */
const LOGO = { size: 22, top: 14 };

/** The print cut made by `npm run brand`: 256px, flattened onto white.
 *
 *  Not the on-screen logo, and both halves of that matter. 256px at 22mm is
 *  ~295dpi, which is as much as a school printer can use. Flat beats
 *  transparent because jspdf turns an alpha PNG into a raw image plus a soft
 *  mask and stops passing the compressed data through: the same certificate
 *  weighs 93KB with this file and 1MB with the transparent 512px one. The
 *  page under it is white anyway, so there is nothing to see either way. */
const LOGO_SRC = "/little-fox-logo-print.png";

/** jspdf and the logo, fetched once and kept.
 *
 *  Not just a speed trick. Safari on iOS only lets a page start a download
 *  while it still counts as reacting to the tap, and a network round trip in
 *  the middle of the handler spends that budget — the button then does nothing
 *  at all, which is exactly what the teacher reported ("โหลดไม่ได้ ต้องเเคปเอา").
 *  Warming both up while the button is merely on screen leaves the tap itself
 *  with nothing to wait for. */
let warmed: Promise<[typeof import("jspdf"), Uint8Array | null]> | null = null;

function assets() {
  // Deliberately does NOT populate the cache — only warmCertificate() does.
  // A screen that never warmed up gets a fresh fetch, which is the behaviour
  // this has always had, rather than bytes from some earlier page.
  return warmed ?? Promise.all([import("jspdf"), loadLogo()]);
}

/** Call this as soon as a certificate becomes available, before it is asked
 *  for. Safe to call repeatedly; the work happens once. */
export function warmCertificate(): void {
  warmed ??= Promise.all([import("jspdf"), loadLogo()]);
  void warmed;
}

export async function downloadCertificate(data: CertificateData): Promise<void> {
  // Resolves from the warm cache in a microtask when warmCertificate() has run,
  // so the tap that got here is still the tap that starts the download.
  const [{ jsPDF }, logo] = await assets();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });

  const w = doc.internal.pageSize.getWidth(); // 210
  const h = doc.internal.pageSize.getHeight(); // 148
  const mid = w / 2;

  // paper
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");

  // marigold frame, then a dashed kraft frame inside it
  doc.setDrawColor(...MARIGOLD);
  doc.setLineWidth(1.4);
  doc.roundedRect(7, 7, w - 14, h - 14, 3, 3);

  doc.setDrawColor(...KRAFT);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([1.4, 1.4], 0);
  doc.roundedRect(10.5, 10.5, w - 21, h - 21, 2, 2);
  doc.setLineDashPattern([], 0);

  // the school's mark at the head of the page. Skipped in silence if it could
  // not be loaded: a student on a flaky connection still gets their
  // certificate, just without the picture.
  if (logo) {
    doc.addImage(logo, "PNG", mid - LOGO.size / 2, LOGO.top, LOGO.size, LOGO.size);
  }

  // issuer line — the school's name, not the game's: this is what a parent
  // reads first, and it is the school that awards the certificate
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...DEEP);
  doc.text(spaced("LITTLE FOX LANGUAGE SCHOOL"), mid, 42, { align: "center" });

  // title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.setTextColor(...INK);
  doc.text("Certificate", mid, 53, { align: "center" });

  // short marigold rule
  doc.setFillColor(...MARIGOLD);
  doc.rect(mid - 9, 57.5, 18, 1.4, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_SOFT);
  doc.text("given to", mid, 66, { align: "center" });

  // the name — the whole point of the page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameSize(data.name));
  doc.setTextColor(...DEEP);
  doc.text(data.name, mid, 79, { align: "center", maxWidth: w - 70 });

  doc.setDrawColor(...EDGE);
  doc.setLineWidth(0.6);
  doc.line(mid - 45, 84, mid + 45, 84);

  // what they did
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(
    `for finishing ${data.unitId.replace("-", " ")} · ${data.unitTitle}`,
    mid,
    92,
    { align: "center", maxWidth: w - 80 }
  );
  doc.setTextColor(...INK_SOFT);
  doc.setFontSize(9);
  doc.text("with very good English.", mid, 99, { align: "center" });

  // stat row, with hairline dividers
  const stats: [string, string][] = [
    ["SCORE", `${data.score} / ${data.maxScore}`],
    ["TIME", formatTime(data.timeSeconds)],
    ["RIGHT", formatPercent(data.accuracy)],
  ];
  if (data.rankLabel) stats.push(["PLACE", data.rankLabel]);

  const columnWidth = 34;
  const rowWidth = columnWidth * stats.length;
  let x = mid - rowWidth / 2 + columnWidth / 2;

  for (const [i, [label, value]] of stats.entries()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...INK_SOFT);
    doc.text(spaced(label), x, 111, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(value, x, 119, { align: "center" });

    if (i < stats.length - 1) {
      doc.setDrawColor(...EDGE);
      doc.setLineWidth(0.5);
      doc.line(x + columnWidth / 2, 107, x + columnWidth / 2, 120);
    }
    x += columnWidth;
  }

  // signature lines
  doc.setDrawColor(...KRAFT);
  doc.setLineWidth(0.5);
  doc.line(24, h - 22, 78, h - 22);
  doc.line(w - 78, h - 22, w - 24, h - 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...INK_SOFT);
  doc.text(spaced("TEACHER"), 24, h - 18);
  doc.text(spaced(formatDate(new Date().toISOString()).toUpperCase()), w - 24, h - 18, {
    align: "right",
  });

  deliver(doc, `little-fox-${data.unitId}-${slug(data.name)}.pdf`);
}

/** Hands the finished PDF to the student.
 *
 *  doc.save() builds a blob URL and clicks a hidden <a download>. That is the
 *  nice path, but a browser can refuse it — an aggressive pop-up/download
 *  blocker, or an in-app webview with no download manager — and jspdf gives no
 *  signal beyond throwing. When it does, open the PDF in a tab instead: the
 *  child can still read it and save it by hand, which beats a button that
 *  looks broken. */
function deliver(doc: JsPdfLike, filename: string): void {
  try {
    doc.save(filename);
    return;
  } catch (saveError) {
    try {
      const url = doc.output("bloburl") as unknown as string;
      const opened = window.open(String(url), "_blank");
      if (opened) return;
    } catch {
      // fall through to the original error, which is the more useful one
    }
    throw saveError;
  }
}

interface JsPdfLike {
  save: (filename: string) => unknown;
  output: (type: string) => unknown;
}

/** The logo as raw bytes, ready for addImage.
 *
 *  Bytes, not a data URL: jspdf's own data-URL branch mis-decodes this file and
 *  throws "Incomplete or corrupt PNG file", while a Uint8Array goes straight
 *  through. It also skips a pointless base64 round trip.
 *
 *  Never throws: the certificate is a reward a child is waiting for, so a
 *  missing image must not cost them the download. Returns null instead and the
 *  page is drawn without it. */
async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(LOGO_SRC);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Letter-spacing is not a jspdf feature; spacing the string is close enough
 *  for the small mono-style labels. */
function spaced(value: string): string {
  return value.split("").join(" ");
}

/** Long names have to fit inside the frame. */
function nameSize(name: string): number {
  if (name.length > 26) return 18;
  if (name.length > 18) return 22;
  return 28;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "student"
  );
}
