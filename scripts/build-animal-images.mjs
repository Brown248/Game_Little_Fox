// Turns the raw shadow/reveal artwork into web-sized WebP the game can serve.
//
//   npm run images -- "C:/path/to/ภาพประกอบ"
//
// The source folder holds numbered pairs — an odd file is the silhouette, the
// next one is the same animal in colour with its English name on it. That
// pairing is the whole Shadow Animal Challenge, so it is spelled out in PAIRS
// below rather than guessed from the numbers.
//
// Output: public/images/animals/<slug>-shadow.webp  (before answering)
//         public/images/animals/<slug>.webp         (the reveal)
//
// 1920x1080 PNGs at up to 830KB each are unusable on a school phone; these come
// out around 30-60KB with no visible loss, because the art is flat vector-style.

import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "images", "animals");

// shadow file, reveal file, slug used in content/units/*.json
const PAIRS = [
  ["13_0.png", "14_0.png", "hippopotamus"],
  ["15_0.png", "16_0.png", "rhinoceros"],
  ["17_0.png", "18_0.png", "lion"],
  ["19_0.png", "20_0.png", "elephant"],
  ["21_0.png", "22_0.png", "polar-bear"],
  ["23_0.png", "24_0.png", "tiger"],
  ["25_0.png", "26_0.png", "crocodile"],
  ["27_0.png", "28_0.png", "blue-whale"],
  ["29_0.png", "30_0.png", "pig"],
  // the teacher's word list asks for POLAR BEAR twice, and the artwork happens
  // to have two poses — so the repeat shows a different picture
  ["31_0.png", "32_0.png", "polar-bear-2"],
];

const WIDTH = 1000; // drawn at most ~600px wide, so this covers a retina phone
const webp = { quality: 80, effort: 6 };

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
    const info = await sharp(path.join(src, file))
      .resize(WIDTH, null, { withoutEnlargement: true })
      .webp(webp)
      .toFile(path.join(OUT, name));
    written += 1;
    bytes += info.size;
    console.log(`  ok    ${name.padEnd(26)} ${(info.size / 1024).toFixed(0)}KB`);
  }
}

console.log(`\n${written} files, ${(bytes / 1024).toFixed(0)}KB total, in public/images/animals\n`);
