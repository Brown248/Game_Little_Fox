// Client-side PDF certificate — landscape A5, built to the visual direction:
// white card, the school logo at the head, marigold rule, dashed kraft inner
// frame, the explorer's name in deep orange, and a stamped seal on the right.
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
const GLOW: [number, number, number] = [255, 232, 201];

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

export async function downloadCertificate(data: CertificateData): Promise<void> {
  // both in parallel: the PDF cannot be drawn without jspdf, and waiting for
  // the logo afterwards would double the wait before the file appears
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo()]);
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
  doc.text("Certificate of Expedition", mid, 53, { align: "center" });

  // short marigold rule
  doc.setFillColor(...MARIGOLD);
  doc.rect(mid - 9, 57.5, 18, 1.4, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_SOFT);
  doc.text("awarded to", mid, 66, { align: "center" });

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
    `for completing ${data.unitId.replace("-", " ")} · ${data.unitTitle}`,
    mid,
    92,
    { align: "center", maxWidth: w - 80 }
  );
  doc.setTextColor(...INK_SOFT);
  doc.setFontSize(9);
  doc.text("with courage, curiosity and very good English.", mid, 99, {
    align: "center",
  });

  // stat row, with hairline dividers
  const stats: [string, string][] = [
    ["SCORE", `${data.score} / ${data.maxScore}`],
    ["TIME", formatTime(data.timeSeconds)],
    ["ACCURACY", formatPercent(data.accuracy)],
  ];
  if (data.rankLabel) stats.push(["CLASS RANK", data.rankLabel]);

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

  // Seal, stamped on the right. Sits high enough that its ring clears the
  // name's line even when a long name runs the full width.
  seal(doc, w - 32, 55, data.unitId.replace("-", " ").toUpperCase());

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

  doc.save(`little-fox-${data.unitId}-${slug(data.name)}.pdf`);
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

/** Dashed ring, glow disc, marigold diamond — the same seal as on screen. */
function seal(
  doc: {
    setDrawColor: (r: number, g: number, b: number) => void;
    setFillColor: (r: number, g: number, b: number) => void;
    setLineWidth: (n: number) => void;
    setLineDashPattern: (p: number[], o: number) => void;
    circle: (x: number, y: number, r: number, style?: string) => void;
    setFont: (f: string, s: string) => void;
    setFontSize: (n: number) => void;
    setTextColor: (r: number, g: number, b: number) => void;
    text: (t: string, x: number, y: number, o?: object) => void;
    triangle: (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      style?: string
    ) => void;
  },
  cx: number,
  cy: number,
  label: string
) {
  doc.setDrawColor(...MARIGOLD);
  doc.setLineWidth(0.7);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.circle(cx, cy, 15);
  doc.setLineDashPattern([], 0);

  doc.setFillColor(...GLOW);
  doc.setDrawColor(...MARIGOLD);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, 11.5, "FD");

  // compass needle as two triangles
  doc.setFillColor(...MARIGOLD);
  doc.triangle(cx, cy - 6, cx - 3, cy, cx + 3, cy, "F");
  doc.triangle(cx, cy + 6, cx - 3, cy, cx + 3, cy, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...DEEP);
  doc.text(spaced(label), cx, cy + 9, { align: "center" });
}

/** Letter-spacing is not a jspdf feature; spacing the string is close enough
 *  for the small mono-style labels. */
function spaced(value: string): string {
  return value.split("").join(" ");
}

/** Long names have to fit between the frame and the seal. */
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
