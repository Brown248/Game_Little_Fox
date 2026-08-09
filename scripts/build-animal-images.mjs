// Turns the raw shadow/reveal artwork into web-sized WebP the game can serve.
//
//   npm run images -- "C:/path/to/ภาพประกอบ"
//
// The source folder holds numbered pairs — an odd file is the silhouette, the
// next one is the same animal in colour with its English name on it. That
// pairing is the whole Shadow Animal Challenge, so it is spelled out in PAIRS
// below rather than guessed from the numbers.
//
// Two things are stripped on the way through, both asked for after the first
// lesson: the purple studio background, so the animal sits on the game's own
// cream instead of a slab of colour that belongs to nothing; and the English
// word printed across the bottom of every reveal, which gave the answer away
// the moment the picture was even glimpsed.
//
// Output: public/images/animals/<slug>-shadow.webp  (before answering)
//         public/images/animals/<slug>.webp         (the reveal)

import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "images", "animals");

// shadow file, reveal file, slug used in content/units/*.json
const PAIRS = [
  ["13_0.png", "14_0.png", "hippopotamus"],
  ["17_0.png", "18_0.png", "lion"],
  ["19_0.png", "20_0.png", "elephant"],
  ["21_0.png", "22_0.png", "polar-bear"],
  ["23_0.png", "24_0.png", "tiger"],
  ["25_0.png", "26_0.png", "crocodile"],
  ["27_0.png", "28_0.png", "blue-whale"],
  ["29_0.png", "30_0.png", "pig"],
];

const WIDTH = 1000; // drawn at most ~600px wide, so this covers a retina phone
const webp = { quality: 82, effort: 6 };

// The word sits at rows 896-1016 of the 1080-tall source; the lowest any animal
// reaches is 856. Cutting at 81% (875px) lands in the gap between the two, so
// the word goes and every animal survives whole. Measured, not guessed —
// re-measure if the artwork ever changes.
const KEEP_HEIGHT = 0.81;

/** How far a pixel may sit from its row's backdrop colour and still count as
 *  backdrop. The nearest any animal colour comes is about 110, so this is
 *  comfortably clear of the artwork while still catching gradient banding. */
const BACKDROP_TOLERANCE = 45;

/** Alpha mask for the artwork: everything that is not the backdrop.
 *
 *  The backdrop is a purely vertical gradient — every row is one flat colour,
 *  from (154,85,240) at the top to (192,146,254) near the bottom — so the true
 *  backdrop colour for a row can be read straight off the left margin, which no
 *  animal reaches. Measuring against that per-row reference is what separates
 *  the purple from a pale blue whale or a white polar bear; a single global
 *  colour rule could not, and that is why this is not a plain chroma key.
 *
 *  Every matching pixel goes, not only those reachable from the frame edge:
 *  the backdrop also shows through gaps between a crocodile's legs and under a
 *  polar bear's belly, and flooding inward left those as purple islands. */
function backdropMask(data, width, height, channels) {
  const alpha = Buffer.alloc(width * height);
  const limit = BACKDROP_TOLERANCE * BACKDROP_TOLERANCE;

  // Six samples from both margins, median per channel. One column is not
  // enough: the pig's frame has a darker band down its left edge, and trusting
  // it put the reference 45 out — exactly at the tolerance, so the real
  // backdrop survived as a purple bar across the finished picture.
  const columns = [2, 6, 10, width - 11, width - 7, width - 3];
  const median = (values) => values.sort((a, b) => a - b)[values.length >> 1];

  for (let y = 0; y < height; y++) {
    const row = y * width;
    const rr = median(columns.map((x) => data[(row + x) * channels]));
    const rg = median(columns.map((x) => data[(row + x) * channels + 1]));
    const rb = median(columns.map((x) => data[(row + x) * channels + 2]));

    for (let x = 0; x < width; x++) {
      const i = (row + x) * channels;
      const dr = data[i] - rr;
      const dg = data[i + 1] - rg;
      const db = data[i + 2] - rb;
      // 255 where the animal is, 0 where the backdrop was
      alpha[row + x] = dr * dr + dg * dg + db * db > limit ? 255 : 0;
    }
  }

  keepLargestShape(alpha, width, height);
  return alpha;
}

/** Erases everything except the biggest connected shape.
 *
 *  Every picture is one animal, so anything else the colour test caught is
 *  rubbish. What it catches in practice: each frame has a soft dark halo in its
 *  top-left corner, deep enough to read as "not the backdrop", and it survived
 *  as a purple smudge floating beside the pig. Being a separate island, it goes
 *  here — as would any speck the artwork picks up later.
 *
 *  8-connected on the hard mask, before the edge is blurred, so a diagonal
 *  hairline still counts as joined. */
function keepLargestShape(alpha, width, height) {
  const label = new Int32Array(width * height); // 0 = unvisited
  const stack = new Int32Array(width * height);
  const sizes = [0]; // sizes[n] belongs to label n
  let best = 0;

  for (let seed = 0; seed < alpha.length; seed++) {
    if (!alpha[seed] || label[seed]) continue;

    const id = sizes.length;
    let size = 0;
    let top = 0;
    stack[top++] = seed;
    label[seed] = id;

    while (top > 0) {
      const p = stack[--top];
      size += 1;
      const x = p % width;
      const y = (p - x) / width;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const q = ny * width + nx;
          if (!alpha[q] || label[q]) continue;
          label[q] = id;
          stack[top++] = q;
        }
      }
    }

    sizes.push(size);
    if (size > sizes[best]) best = id;
  }

  if (!best) return;
  for (let p = 0; p < alpha.length; p++) {
    if (label[p] !== best) alpha[p] = 0;
  }
}

async function cutOut(file) {
  const meta = await sharp(file).metadata();

  // One buffer to work from: a sharp instance cannot be reused for two
  // different pipelines, and this needs both the pixels and the picture.
  const cropped = await sharp(file)
    .extract({
      left: 0,
      top: 0,
      width: meta.width,
      height: Math.round(meta.height * KEEP_HEIGHT),
    })
    .png()
    .toBuffer();

  const { data, info } = await sharp(cropped)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const alpha = backdropMask(data, info.width, info.height, info.channels);

  // A hard mask leaves a purple hairline where the artwork was anti-aliased
  // against the backdrop. One pixel of blur softens that edge away.
  // Read the channel count back rather than assuming it stayed at 1 — sharp
  // may hand back a three-channel greyscale, and indexing that as one channel
  // silently scrambles the mask.
  const { data: softened, info: softInfo } = await sharp(alpha, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .blur(1)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // dest-in reads the OVERLAY'S ALPHA, not its brightness — handing it a plain
  // greyscale image keeps everything, because such an image is fully opaque.
  // The mask has to travel in the alpha channel itself.
  const pixels = info.width * info.height;
  const rgba = Buffer.alloc(pixels * 4);
  for (let p = 0; p < pixels; p++) {
    rgba[p * 4] = 255;
    rgba[p * 4 + 1] = 255;
    rgba[p * 4 + 2] = 255;
    rgba[p * 4 + 3] = softened[p * softInfo.channels];
  }

  const cut = await sharp(cropped)
    .ensureAlpha()
    .composite([
      {
        input: rgba,
        raw: { width: info.width, height: info.height, channels: 4 },
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  return sharp(cut)
    .trim({ threshold: 1 }) // drop the empty margin the backdrop left behind
    .resize(WIDTH, null, { withoutEnlargement: true, fit: "inside" });
}

const src = process.argv[2];
if (!src) {
  console.error('usage: npm run images -- "C:/path/to/artwork folder"');
  process.exit(1);
}

const present = new Set(await readdir(src));
await mkdir(OUT, { recursive: true });

let written = 0;
let bytes = 0;

for (const [shadow, reveal, slug] of PAIRS) {
  for (const [file, name] of [
    [shadow, `${slug}-shadow.webp`],
    [reveal, `${slug}.webp`],
  ]) {
    if (!present.has(file)) {
      console.log(`  skip  ${file} (not in the folder) -> ${name}`);
      continue;
    }
    const info = await (await cutOut(path.join(src, file)))
      .webp(webp)
      .toFile(path.join(OUT, name));
    written += 1;
    bytes += info.size;
    console.log(
      `  ok    ${name.padEnd(26)} ${String(info.width).padStart(4)}x${String(info.height).padEnd(4)} ${(info.size / 1024).toFixed(0)}KB`
    );
  }
}

console.log(`\n${written} files, ${(bytes / 1024).toFixed(0)}KB total, in public/images/animals\n`);
