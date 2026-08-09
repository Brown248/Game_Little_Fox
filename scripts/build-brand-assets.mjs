// Cuts every logo asset the site uses out of one master artwork.
//
//   npm run brand
//
// Input : brand/little-fox-logo-master.png   (square, transparent background)
// Output: public/little-fox-logo.png        full lockup, used at ≥96px
//         public/little-fox-logo-print.png  the same, for the PDF certificate
//         public/little-fox-mark.png        fox head in the ring, used small
//         app/icon.png                      browser tab (Next wires it up)
//         app/apple-icon.png                iOS home screen
//         app/opengraph-image.png           link preview
//
// To rebrand: drop a new master in brand/ and re-run. HEAD below is the crop
// used for the small mark — adjust it if the new artwork frames its character
// differently, then eyeball public/little-fox-mark.png.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const at = (...p) => path.join(root, ...p);

const MASTER = at("brand", "little-fox-logo-master.png");

// sampled straight off the artwork so the generated ring matches it exactly
const RING = "#fc5002";
const CREAM = "#fae7cd";
const PAGE = "#fdf3e3"; // the app's own --page token

// the head crop, in master-image pixels, for the small mark
const HEAD = { left: 0.236, top: 0.049, size: 0.519 }; // fractions of the master

const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const png = { compressionLevel: 9, effort: 10 };
const circle = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );

const master = sharp(MASTER);
const meta = await master.metadata();
if (meta.width !== meta.height) {
  throw new Error(`master must be square, got ${meta.width}x${meta.height}`);
}

await mkdir(at("public"), { recursive: true });

/* ---- the full lockup ---- */
const logo = await sharp(MASTER).resize(512, 512).png(png).toBuffer();
await sharp(logo).toFile(at("public", "little-fox-logo.png"));

/* ---- the same lockup for the PDF certificate ----
   Smaller and opaque on purpose: jspdf re-encodes a transparent PNG into a raw
   image plus a soft mask, which takes the certificate from 93KB to 1MB. 256px
   at the 22mm it is drawn is ~295dpi, and the page behind it is white. */
await sharp(MASTER)
  .resize(256, 256)
  .flatten({ background: "#ffffff" })
  .png(png)
  .toFile(at("public", "little-fox-logo-print.png"));

/* ---- the small mark: the head, on the badge's cream, inside its ring ----
   The full lockup turns to mush below ~64px, so the browser tab and the 44px
   header dot get this instead. */
const MARK = 256;
const INNER = 240;
const head = await sharp(MASTER)
  .extract({
    left: Math.round(HEAD.left * meta.width),
    top: Math.round(HEAD.top * meta.height),
    width: Math.round(HEAD.size * meta.width),
    height: Math.round(HEAD.size * meta.height),
  })
  .resize(INNER, INNER)
  .composite([{ input: circle(INNER), blend: "dest-in" }])
  .png()
  .toBuffer();

const mark = await sharp({
  create: { width: MARK, height: MARK, channels: 4, background: clear },
})
  .composite([
    {
      input: Buffer.from(
        `<svg width="${MARK}" height="${MARK}"><circle cx="128" cy="128" r="123" fill="${CREAM}" stroke="${RING}" stroke-width="9"/></svg>`
      ),
    },
    { input: head, top: (MARK - INNER) / 2, left: (MARK - INNER) / 2 },
  ])
  .png(png)
  .toBuffer();

await sharp(mark).toFile(at("public", "little-fox-mark.png"));
await sharp(mark).toFile(at("app", "icon.png"));

/* ---- iOS home screen: square and opaque, iOS rounds the corners itself ---- */
await sharp({ create: { width: 180, height: 180, channels: 4, background: PAGE } })
  .composite([{ input: await sharp(mark).resize(164, 164).toBuffer(), top: 8, left: 8 }])
  .png(png)
  .toFile(at("app", "apple-icon.png"));

/* ---- link preview ---- */
await sharp({ create: { width: 1200, height: 630, channels: 4, background: PAGE } })
  .composite([{ input: await sharp(logo).resize(520, 520).toBuffer(), top: 55, left: 340 }])
  .png(png)
  .toFile(at("app", "opengraph-image.png"));

console.log("brand assets rebuilt from", path.relative(root, MASTER));
