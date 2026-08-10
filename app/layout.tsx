import { Baloo_2, IBM_Plex_Mono, Nunito } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import "./globals.css";

// Self-hosted at build time by next/font: no request to Google from a
// student's phone, no layout shift, and the app still looks right on a school
// network that blocks external font hosts.
const display = Baloo_2({
  subsets: ["latin"],
  // 700 and 800 are the only weights globals.css ever asks Baloo for.
  // Note this does NOT make the download smaller — Baloo 2 is a variable font,
  // so next/font ships one file per subset covering every weight either way
  // (measured: same 19 files, same 428KB, with two weights or four). It is
  // here to say what the design system actually uses.
  weight: ["700", "800"],
  variable: "--font-display",
  display: "swap",
});

const text = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-text",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// The browser tab icon, the iOS home-screen icon and the link preview all come
// from the files next to this one — app/icon.png, app/apple-icon.png and
// app/opengraph-image.png — which Next wires up on its own. All three are cut
// from public/little-fox-logo.png, so there is one master artwork to replace.
// Link previews need an absolute URL for the image. NEXT_PUBLIC_SITE_URL is the
// same value the QR poster uses; VERCEL_URL keeps preview deployments correct
// when nobody has set it yet.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

export const metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: SITE_NAME,
    // every other page just names itself; the suffix is added here
    template: `%s · ${SITE_NAME}`,
  },
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // viewportFit is what makes env(safe-area-inset-*) resolve to anything other
  // than zero on iOS. Without it the two places that reserve room for the home
  // indicator — .page's bottom padding and .appfoot__in — were dead code, and
  // the last button on a screen sat under the gesture strip.
  viewportFit: "cover",
  // No maximumScale: pinch-zoom is left uncapped on purpose.
  themeColor: "#FDF3E3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // Next 16 stopped overriding scroll-behavior during navigation on its
      // own; this attribute asks for the old behaviour, so a route change still
      // jumps to the top instead of smooth-scrolling the whole page.
      data-scroll-behavior="smooth"
      className={`${display.variable} ${text.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
