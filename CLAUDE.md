# CLAUDE.md

คู่มือทำงานกับ repo นี้ · อ่านให้จบก่อนแก้อะไร

**Little Fox Game** (ของ Little Fox Language School) — เกมเรียนคำศัพท์สัตว์ (ภาษาอังกฤษ) แบบเล่นเป็นด่าน
ผู้เล่นพิมพ์ "ชื่อ" อย่างเดียว แล้วเล่นมินิเกมในแต่ละยูนิต · เก็บคะแนนขึ้นลีดเดอร์บอร์ด
**ระบบครบทุกหน้าแล้ว** — เกม 5 แบบ · engine · ลีดเดอร์บอร์ด 2 หน้า · PDF certificate · หลังบ้าน `/admin` (4 หน้า) · QR generator · RLS
**ที่เหลือเป็นงาน "เนื้อหา" ไม่ใช่งานระบบ:** เขียน JSON อีก 19 ยูนิต · อัดไฟล์เสียง mp3 · ใส่ key จริง · แต่งดีไซน์

> 🤖 **ทีม agent:** repo นี้มีทีม subagent ใน `.claude/agents/` (architect · explorer · coder · reviewer · tester)
> งานที่ไม่เล็กให้กระจายให้ทีมแทนทำเดี่ยว · ทุกตัวอ่านไฟล์นี้ก่อนเสมอ

---

## Stack

- **Next.js 16** (App Router — ไม่ใช่ Pages Router · **Turbopack เป็น bundler ค่าเริ่มต้นทั้ง dev และ build**) · **React 19.2** · **TypeScript 5.5 strict**
- **Supabase** (`@supabase/supabase-js`) — Postgres + เก็บคะแนน · dependency หลัก
- **jspdf** — ออก PDF certificate ฝั่ง client · เรียกด้วย **dynamic `import()` ตอนกดปุ่มเท่านั้น** ห้าม import แบบ static
- **qrcode** — สร้าง QR ฝั่ง server (`/admin/qr`) เป็น inline SVG · ไม่เรียก API ภายนอก
- target `ES2020` · module `esnext` + bundler resolution
- **styling = `app/globals.css` ไฟล์เดียว** (design token + component class) — **ไม่ใช้ Tailwind/CSS Modules** ห้ามเขียน inline style เว้นค่าที่คำนวณจริงหรือ state ชั่วคราว
- **ฟอนต์ผ่าน `next/font/google`** ใน `app/layout.tsx` (Baloo 2 · Nunito · IBM Plex Mono) → self-host ตอน build **ไม่ยิงขอ Google จากมือถือนักเรียน** ห้ามเปลี่ยนไปใช้ `<link>`
- **vitest + @testing-library/react + jsdom** เป็น test framework (ดู `tests/README.md`)
- **ยังไม่มี** global state library (Context/Redux — ใช้ localStorage ผ่าน `lib/session.ts`)
- `next.config.js` มีแค่ `outputFileTracingIncludes` เพื่อให้ `content/units/**` ติดไปกับ bundle บน Vercel (เพราะ `lib/units.ts` อ่านด้วย `fs`) — **อย่าลบ ไม่งั้นยูนิตหายบน production**

## คำสั่ง

```bash
npm run dev      # next dev — เซิร์ฟเวอร์ dev
npm run build    # next build — ต้องผ่านก่อนบอกว่าเสร็จ
npm run start    # next start — รัน production build
npm run lint     # eslint . — ESLint CLI ตรงๆ (`next lint` ถูกถอดใน Next 16)
npm test         # vitest — 165 เทส (logic + คอมโพเนนต์ ใน jsdom) ไม่ต้องมีอะไรรันอยู่
npm run test:db  # vitest — 64 เทส ยิง Postgres + PostgREST จริงใน docker (ดู tests/README.md)
npm run brand    # สร้างไฟล์โลโก้ทุกขนาดใหม่จาก brand/little-fox-logo-master.png
npm run images -- "C:/path/to/ภาพประกอบ"   # แปลงภาพวาดสัตว์ PNG → WebP ลง public/images/animals (คู่เงา/เฉลย ดู PAIRS ในสคริปต์)
npm run check:db # เช็ก Supabase "ตัวจริง" ที่อยู่ใน .env.local — key ใช้ได้ไหม · รัน schema.sql แล้วยัง · RLS เปิดอยู่ไหม (อ่านอย่างเดียว ไม่เขียนข้อมูล)
```

> **"ตรวจว่าเสร็จ" = `npm test` + `npm run build` + `npm run lint` ผ่านทั้งสาม**
> (typecheck รวมอยู่ใน build) · แก้อะไรที่แตะ schema/RLS/query ต้องรัน `npm run test:db` ด้วย
> ห้ามบอกว่าเสร็จถ้ายังไม่ได้รัน ห้ามเดาว่าน่าจะผ่าน
> ⚠️ **Next 16: `next build` ไม่รัน lint ให้แล้ว** — ต้องรัน `npm run lint` แยกเองเสมอ (ก่อนหน้านี้ build จับให้)

## ตั้งค่าก่อนรัน

คัดลอก `.env.example` → `.env.local` แล้วเติมค่า **แล้วรัน `npm run check:db` เพื่อยืนยันว่าต่อติดจริง**
(`.gitignore` กัน `.env*` ไว้หมดแล้ว — `service_role key` ห้ามขึ้น git เด็ดขาด):

| ตัวแปร | ฝั่ง | ใช้ทำอะไร |
|--------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | client | URL ของ Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | anon key สำหรับ query ฝั่ง client |
| `SUPABASE_SERVICE_ROLE_KEY` | **server เท่านั้น** | งาน admin (แก้/ลบ player) — ห้ามหลุดไป client |
| `ADMIN_PASSWORD` | server | รหัสผ่านกั้นหน้า `/admin` |

---

## โครงสร้าง

```
app/                  Next.js App Router (route + layout) · globals.css = ธีมทั้งโปรเจกต์
  error.tsx · not-found.tsx   error boundary + 404 ทั้งแอป
  icon.png · apple-icon.png · opengraph-image.png · manifest.ts   ไอคอนแท็บ/โฮมสกรีน/ลิงก์พรีวิว (Next ต่อสายให้เอง ห้ามเปลี่ยนชื่อไฟล์)
  admin/actions.ts     server actions ทั้งหมดของหลังบ้าน
components/            Shell (SiteHeader + main + SiteFooter) · StartForm · PlayClient (engine loop) · ResultScreen · UnitLeaderboard · OverallLeaderboard
components/games/      คอมโพเนนต์มินิเกม 5 แบบ + ตัวช่วยที่ใช้ร่วม: ChoiceList (A/B/C/D + seal/burst) · Progress (หัวข้อ+แทร็ก) · Feedback
components/admin/      AdminLogin · AdminNav · PlayersTable · MergePlayers · AttemptsTable · SetupNotice · PrintButton
lib/                   ดูตารางข้างล่าง
content/units/         นิยามยูนิตเป็นไฟล์ JSON + `_template.json` + `README.md` (กติกาการเขียนยูนิต)
public/audio/          ไฟล์เสียง — path ใน JSON เป็น relative แล้วต่อ prefix `/audio/` ให้ (URL เต็มก็ใส่ได้)
public/images/animals/ ภาพวาดสัตว์ คู่ `<slug>-shadow.webp` + `<slug>.webp` — สร้างด้วย `npm run images` **อย่าแก้ด้วยมือ**
brand/                 ต้นฉบับโลโก้ (`little-fox-logo-master.png`) — ไฟล์เดียวที่เป็น "ของจริง"
scripts/               `build-brand-assets.mjs` = ตัดโลโก้ทุกขนาดจาก master (`npm run brand`)
supabase/schema.sql    DDL + RLS ของ Postgres (รันครั้งเดียวตอนตั้ง · re-run ได้)
tests/                 unit + component (jsdom) · tests/db = integration กับ Postgres จริง (ดู tests/README.md)
```

**หน้าที่ของแต่ละ lib:**

| ไฟล์ | ฝั่ง | หน้าที่ |
|------|-----|---------|
| `types.ts` | ทั้งสอง | type ทั้งโปรเจกต์ **นิยามที่นี่ก่อนเสมอ** (รวม shape ของ admin summary เพื่อให้ client import ได้) |
| `format.ts` | ทั้งสอง | `formatTime` `formatPercent` `formatDateTime` `formatDate` `gameLabel`/`GAME_LABELS` — **ต้อง client-safe** |
| `supabase.ts` | client | anon client + query ของนักเรียน |
| `scoring.ts` | client | state คะแนน/เวลา |
| `session.ts` | client | player ที่ล็อกอินไว้ใน `localStorage["we.player"]` (ไม่ใช่ sessionStorage) |
| `certificate.ts` | client | `downloadCertificate()` (lazy-load jspdf) |
| `units.ts` | **server-only** | อ่าน `content/units/*.json` ด้วย `fs` + validate · `listUnits` `getUnit` `auditUnits` `listBrokenUnitFiles` |
| `supabase-admin.ts` | **server-only** | service-role client (bypass RLS) |
| `admin-data.ts` | **server-only** | query + aggregate ของหลังบ้าน |
| `admin-auth.ts` | **server-only** | ประตูรหัสผ่าน `/admin` |

> ⚠️ ไฟล์ที่ขึ้นต้นด้วย `import "server-only"` **ห้ามถูก import จาก client component แม้แต่ค่าคงที่เดียว**
> (จะ build fail ทันที) ถ้า client ต้องใช้ label/type ให้ไปไว้ที่ `format.ts` / `types.ts`

**Routes** (`app/`)

| เส้นทาง | ไฟล์ | หน้าที่ |
|---------|------|---------|
| `/` | `app/page.tsx` | เลือกห้อง/กรอกชื่อ/เลือกยูนิต — ลิสต์ยูนิตมาจาก `listUnits()` |
| `/play/[unitId]` | `app/play/[unitId]/page.tsx` | server: resolve unit → `components/PlayClient.tsx` คือ engine จริง |
| `/leaderboard/[unitId]` | `app/leaderboard/[unitId]/page.tsx` | อันดับรายยูนิต |
| `/leaderboard/overall` | `app/leaderboard/overall/page.tsx` | อันดับรวมทุกยูนิต |
| `/admin` | `app/admin/page.tsx` | ภาพรวม: จำนวนนักเรียน/ครั้งที่เล่น · ทักษะที่ห้องอ่อนสุด · attempt ล่าสุด 25 รายการ |
| `/admin/players` | `.../players/page.tsx` | รายชื่อนักเรียน · แก้ชื่อ/ห้อง · ลบ · **merge คนซ้ำ** |
| `/admin/players/[playerId]` | `.../players/[playerId]/page.tsx` | รายคน: accuracy · ทักษะ · ยูนิตที่ยังไม่เล่น · attempt ทุกครั้ง |
| `/admin/units` | `.../units/page.tsx` | ตรวจสุขภาพเนื้อหา (ไฟล์เสีย · คะแนนเต็ม · เสียงที่ยังไม่มี) + สถิติรายยูนิต |
| `/admin/qr` | `.../qr/page.tsx` | QR สำหรับติดผนัง (สร้างฝั่ง server) + ปุ่มพรินต์ |

> ⚠️ **Next 15: `params` เป็น Promise** — route ที่มี dynamic segment ต้องประกาศ
> `{ params: Promise<{ unitId: string }> }` แล้ว `await params` ไม่ทำจะ build ไม่ผ่าน
> ทุก route ที่ query Supabase / อ่าน `fs` ตั้ง `export const dynamic = "force-dynamic"`

**Path alias:** `@/*` → `./` (เช่น `import { supabase } from '@/lib/supabase'`)

---

## สถาปัตยกรรมข้อมูล — จุดสำคัญ

### เกมขับเคลื่อนด้วย JSON — เพิ่มยูนิต = เพิ่มไฟล์ ไม่ต้องแตะโค้ด

ยูนิตหนึ่ง = ไฟล์ JSON หนึ่งใน `content/units/` ตาม `UnitConfig` (`lib/types.ts`):
```ts
interface UnitConfig { id: string; title: string; games: GameBlock[]; }
```
**เพิ่มยูนิตใหม่ให้เพิ่มไฟล์ JSON — ห้ามฝังข้อมูลเกมลงในคอมโพเนนต์**
ชื่อไฟล์ต้องตรง `unit-\d{2}.json` และ `id` ข้างในต้องเท่าชื่อไฟล์ ไม่งั้น `lib/units.ts`
จะปฏิเสธ (log เหตุผลลง console) แล้วหน้า play จะ 404 · ไม่ต้องแก้โค้ดหรือ registry ใดๆ

`GameBlock` เป็น **discriminated union บน `type`** (`QuizChoiceBlock | UnscrambleBlock |
SentenceBuilderBlock | ListeningBlock | WritingBlock`) — `switch (block.type)` ใน
`PlayClient.tsx` จึง narrow ให้เอง **ห้ามใช้ `as` cast ที่นี่** ถ้าต้อง cast แปลว่า type ผิด

**5 ชนิดเกม** (นิยามใน `lib/types.ts`) — คอมโพเนนต์อยู่ที่ `components/games/{Name}.tsx`:

| ชนิด (`type`) | คอมโพเนนต์ | ทำอะไร |
|--------------|-----------|--------|
| `quiz-choice` | `QuizChoice.tsx` | เลือกตอบพร้อม clue |
| `unscramble` | `Unscramble.tsx` | เรียงตัวอักษรเป็นคำ · ถ้า item มี `art` (ภาพวาดจริง) จะโชว์**ภาพเงา**ในกรอบก่อน แล้ว crossfade เป็นภาพสีตอนเฉลย · ถ้าไม่มี `art` แต่มี `shadow` (emoji) จะโชว์เป็น**เงาดำ**แล้วสว่างเป็นสี |
| `sentence-builder` | `SentenceBuilder.tsx` | แตะคำเรียงเป็นประโยค |
| `listening` | `Listening.tsx` | ฟังเสียงแล้วเลือกตอบ |
| `writing` | `Writing.tsx` | เขียนอิสระ (ไม่คิดคะแนน · อยู่ท้ายสุดเสมอ) |

**สัญญา (contract) ของทุกคอมโพเนนต์เกมต้องเหมือนกัน:** รับ `items`/`prompt` + callback `onAnswer(isCorrect: boolean)` และ `onDone()` — เพิ่มเกมชนิดใหม่ต้องตามรูปนี้
(`Writing` ไม่มี `onAnswer` เพราะไม่คิดคะแนน · `onDone(text)` แต่ engine ทิ้ง text)

**กติกาการตอบ — ทุกเกมต้องเหมือนกัน:** ตอบได้ **ครั้งเดียวต่อข้อ** ห้ามลองใหม่
`onAnswer` ยิงครั้งเดียวต่อข้อเสมอ (guard ด้วย state `answered`/`picked`) → 1 ข้อ = 10 คะแนน
ตรงกับ default ของ `recordAnswer` · ถ้าให้ลองใหม่ได้ accuracy จะเทียบกันไม่ได้ทั้งลีดเดอร์บอร์ด

### Supabase — client + query อยู่ที่ `lib/supabase.ts` ที่เดียว

- `findOrCreatePlayer(name)` — หา/สร้าง player · **dedupe แบบ case-insensitive + trim** (unique บน `lower(trim(name))`) · กู้จาก 23505 เองถ้าสองเครื่องยิงพร้อมกัน
- `saveAttempt(record)` — บันทึกผลลง table `attempts`
- `getUnitRanking(unitId)` / `getOverallRanking()` — อ่านจาก **view** `v_unit_ranking` / `v_overall_ranking`
- **ห้าม re-sort ผลลัพธ์ฝั่ง client** — ลำดับที่ view/query ให้มา *คือ* กติกาอันดับ
- `v_overall_ranking` **join `players` เอา name มาเองใน SQL** เพราะ PostgREST
  embed ผ่าน aggregate view ซ้อน view ไม่ได้ (จะ 400) — ถ้าจะแก้ view นี้ ต้องคงคอลัมน์ `name` ไว้

**2 ตาราง** (`supabase/schema.sql`): `players` · `attempts` (มี `game_type_breakdown` เป็น jsonb)

**กติกาการจัดอันดับ — อย่าทำพัง:**
- ลีดเดอร์บอร์ดรายยูนิต = **เอาผลดีที่สุดต่อ player ต่อยูนิต** (คะแนนสูงสุด · เสมอตัดด้วยเวลาที่เร็วกว่า)
- อันดับรวม = **ถ่วงด้วยความแม่น** `sum(score) / sum(max_score)` ไม่ใช่คะแนนดิบรวม
  (กันไม่ให้ยูนิตที่มีคำถามเยอะครองอันดับ) — **ห้ามเปลี่ยนเป็นผลรวมคะแนนดิบ**

### คะแนน — ใช้ helper ใน `lib/scoring.ts`

`createScoringState()` · `recordAnswer(state, gameType, isCorrect, points)` (อัปเดตแบบ immutable) · `elapsedSeconds(state)`
เก็บ breakdown แยกตามชนิดเกม — **อย่าเขียน logic คะแนนเองในแต่ละหน้า ให้เรียก helper ชุดนี้**

- `recordAnswer` ต้อง **immutable จริง รวมถึง object ข้างใน `breakdown`** — ถ้าไป mutate
  bucket เดิม React StrictMode (dev เรียก updater 2 ครั้ง) จะทำให้ breakdown บวมเท่าตัว
- `createScoringState` ตั้ง `startedAt` ตอนถูกเรียก → ใน component ต้องส่ง **reference**
  ให้ `useState(createScoringState)` ไม่ใช่ `useState(createScoringState())` ไม่งั้นเวลารีเซ็ตทุก render
- `saveAttempt` ต้องยิง **ครั้งเดียวต่อรอบเล่น** — `PlayClient` กันด้วย ref + saveState

---

## ตัวตนผู้เล่น & ความปลอดภัย

- **ไม่มีระบบล็อกอิน ไม่มีห้องเรียน** — ตัวตนคือ **ชื่อที่พิมพ์** เท่านั้น (unique index บน `lower(trim(name))`) · player ที่ "ล็อกอิน" อยู่เก็บใน `localStorage` ผ่าน `lib/session.ts`
- ⚠️ **ผลที่ตามมา: ชื่อซ้ำ = คนเดียวกัน** ถ้ามีเด็กสองคนชื่อเล่นเหมือนกันจะแชร์คะแนนกัน ต้องให้คนหนึ่งเติมนามสกุล/ชื่อจริง (ซ่อมย้อนหลังได้ที่ `/admin/players` → เปลี่ยนชื่อ หรือ merge)
- `SUPABASE_SERVICE_ROLE_KEY` และ `ADMIN_PASSWORD` เป็นของ **ฝั่ง server เท่านั้น** — ห้าม import เข้าโค้ดที่รันบน client (จะหลุด key)
- query ปกติของผู้เล่นใช้ anon key ผ่าน `lib/supabase.ts`

### RLS (อยู่ท้าย `supabase/schema.sql`)

`players` + `attempts` เปิด RLS แล้ว · role `anon` (นักเรียน) ทำได้แค่ **select + insert**
พร้อม check ขอบเขตค่า (`score <= max_score` · ชื่อยาว 1–60 ฯลฯ) · **update/delete ถูก revoke ทั้งคู่**
→ นักเรียนลบคะแนนตัวเองหรือคนอื่นไม่ได้ ตรงกับกฎ "ห้ามลบ attempt เก่า"
หลังบ้านใช้ service-role key ที่ bypass RLS จึงยังแก้/merge/ลบได้
**ถ้าเพิ่มตารางใหม่ ต้องเปิด RLS + เขียน policy เองด้วย** ไม่งั้นเปิดโล่ง

### ประตูหลังบ้าน `/admin`

- รหัสเดียวจาก `ADMIN_PASSWORD` · ไม่มีระบบ user (มีแอดมินคนเดียว)
- session = cookie `we_admin` แบบ httpOnly ค่าเป็น `<expiry>.<HMAC-SHA256>` เซ็นด้วย
  `ADMIN_PASSWORD` เอง (**เปลี่ยนรหัส = เตะทุก session ออก**) อายุ 12 ชม. · path `/admin`
- `app/admin/layout.tsx` กั้น **การ render** ของทุกหน้าใต้ `/admin`
- ⚠️ **server action ทุกตัวที่แก้ข้อมูลต้องเรียก `requireAdmin()` เป็นบรรทัดแรกเอง** —
  layout กันแค่หน้าจอ ตัว action เป็น endpoint สาธารณะจนกว่าจะเช็ค
- `deleteAttemptAction` มีไว้ลบ "แถวทดสอบ" เท่านั้น ไม่ใช่เครื่องมือใช้ประจำ ·
  ซ่อมชื่อซ้ำให้ใช้ **merge** (ย้าย attempt แล้วลบตัวซ้ำ) ไม่ใช่ลบทิ้ง

## เกร็ด / กับดัก

- **Listening:** ถ้าไม่มี `audioUrl` (หรือโหลดไฟล์ไม่ได้) จะ fallback ไป browser TTS · path relative ใน JSON จะถูกต่อ prefix `/audio/` · ใส่ URL เต็มของ Supabase Storage ก็ได้ · **ตอนนี้ยังไม่มี mp3 จริง → ได้ TTS ทุกครั้ง**
- **Writing:** เก็บแค่ "ทำเสร็จ" ไม่เก็บข้อความที่พิมพ์ (ตั้งใจ) และไม่คิดคะแนน
- **ใครได้ certificate:** ต้อง **เล่นทั้ง Unit** (เล่นทีละ Part ไม่ได้ ไม่งั้นใบเยอะเกิน) **และตอบถูก ≥ ครึ่งหนึ่งของจำนวนข้อ** — นับจาก `correctCount / totalQuestions` **ไม่ใช่คะแนนดิบ** (วันนี้ค่าเท่ากันเพราะข้อละ 10 แต่ถ้าคะแนนต่อข้อเปลี่ยน กติกาต้องยังอิงข้อถูก) · เกณฑ์อยู่ที่ `CERTIFICATE_PASS_MARK` ใน `ResultScreen.tsx` ที่เดียว · ไม่ผ่านให้บอกว่าต้องถูกกี่ข้อ อย่าซ่อนปุ่มเฉยๆ
- **Certificate:** A5 นอน · โลโก้บนหัว + กรอบส้ม + กรอบ dashed + seal · `jspdf` ใช้ฟอนต์ built-in (Latin-1) → **ชื่อไทยจะออกมาเป็นสี่เหลี่ยม** ถ้าต้องรองรับต้อง embed ฟอนต์ไทย · หัวใบใช้ชื่อ **โรงเรียน** (`LITTLE FOX LANGUAGE SCHOOL`) ไม่ใช่ชื่อเกม เพราะคนออกใบคือโรงเรียน
- **โลโก้ใน PDF — 2 กับดักที่วัดมาแล้ว อย่าแก้กลับ:**
  - ส่ง **`Uint8Array` เข้า `addImage` ห้ามส่ง data URL** — jspdf ถอด data URL ของไฟล์นี้พังแล้วโยน `Incomplete or corrupt PNG file`
  - ใช้ **`public/little-fox-logo-print.png`** (256px ทับพื้นขาว) ไม่ใช่ `little-fox-logo.png` (512px โปร่งใส) — PNG โปร่งใสทำให้ jspdf แตกเป็น raw image + soft mask ไฟล์พองจาก **~40KB เป็น ~1MB**
  - โหลดด้วย `fetch` ตอนกดปุ่ม (คู่กับ dynamic import ของ jspdf) — ถ้าโหลดไม่ได้ให้ **ข้ามรูปแล้วออกใบต่อ** ห้ามให้เด็กอดได้ใบเพราะรูปโหลดไม่ขึ้น
  - เลย์เอาต์ยันกันไว้แล้ว: โลโก้ y 14–36 · seal x 163–193 / y 40–70 · ชื่อยาวสุดกว้างถึง x 151 เท่านั้น **ขยับตัวเลขพวกนี้ต้องวัดใหม่**
- **`unique (expr, col)` ใน `create table` เป็น syntax error ของ Postgres** — ต้องเป็น `create unique index` แยก (ของเดิมพังทั้งไฟล์ แก้แล้ว) เพิ่ม constraint แบบมี expression ครั้งหน้าให้ระวังจุดนี้
- **"เล่นอีกครั้ง"** ต้องใช้ `window.location.reload()` ไม่ใช่ `router.refresh()` — refresh ไม่ล้าง client state เกมจะไม่เริ่มใหม่
- ถ้าไม่มี `.env.local` แอปยัง build/render ได้ (client ชี้ไป localhost หลอกๆ) แต่ทุก query จะ fail เป็น network error ซึ่งหน้าจอจัดการไว้แล้ว

## ดีไซน์ & motion — ทำตาม `app/globals.css` เท่านั้น

มาจาก "Quiz app design system.zip" ทั้งสองไฟล์:
`Wildlife Explorer.dc.html` = สเปกสี/ตัวอักษร/motion (v1) · `Wildlife Explorer Web.dc.html` = เลย์เอาต์เว็บที่ยึดตอนนี้ (responsive 360→1440 ไม่มี breakpoint)
**ห้ามใส่สีหรือค่า easing เป็นเลขดิบในคอมโพเนนต์ ให้ใช้ token ใน `:root`**

| กลุ่ม | token | ใช้ทำอะไร |
|------|-------|-----------|
| action | `--marigold #F28C28` · `--marigold-press #D9741A` · `--deep #C4600F` · `--glow #FFE8C9` | ปุ่ม · เงาแข็งใต้ปุ่ม · ตัวอักษร/ขอบสีส้ม · พื้นคำตอบที่ถูก |
| ground | `--page #FDF3E3` · `--edge #F3E4CE` · `--kraft #E2CDAE` | พื้นทุกหน้า · เส้นขอบการ์ด · แทร็กว่าง/ตอบผิด |
| surface | `--surface #FFF` · `--surface-warm #FFFCF6` | การ์ด · แผงซ้อนใน |
| ink | `--ink #2E2A26` · `--ink-soft #6B6155` · `--ink-mute` · `--ink-faint` | ตัวหนังสือไล่น้ำหนัก |

- **ฟอนต์ 3 ตัว:** Baloo 2 (`--font-display`) = หัวข้อ/ตัวเลข/ปุ่ม **ไม่ต่ำกว่า 20px** ·
  Nunito (`--font-text`) = เนื้อหา **ไม่ต่ำกว่า 17px** · IBM Plex Mono (`--font-mono`) = label เล็ก uppercase (คลาส `.kicker`)
- **spring เดียวทั้งระบบ:** `var(--spring)` = `cubic-bezier(.34,1.56,.64,1)` · hover `scale 1.02–1.06` · tap `0.94–0.97`
- **ปุ่มหลัก** (`.btn`) นั่งบนเงาแข็ง 8px · กดแล้ว `translateY(5px) scaleY(.96)` + เงาเหลือ 3px นี่คือลายเซ็นของงาน
- **ตอบถูก:** พื้น glow + seal เด้ง (`wePop`) + ring ขยายหายไป (`weBurst`) + คะแนนลอยขึ้น (`weRise`) รวมไม่เกิน 600ms
- **ตอบผิด:** สั่น 4 จังหวะ ±7px (`weShake`) + เปลี่ยนเป็น kraft — **ห้ามใช้สีแดง ห้ามหักคะแนน**
- **เลขที่เปลี่ยน** (คะแนน/เวลา/streak) ใส่ `key` แล้วให้คลาส `.tick` เล่น `weTick` 300ms
- **หน้าจอ/ข้อถัดไป** เลื่อนเข้า `weSlide` 260ms · ผลลัพธ์เข้าด้วย `.wipe-up` · ไม่ตัดภาพแข็งๆ
- **idle หายใจได้:** badge ลอย `weFloat` 7px รอบ 3–4.5s ห้ามเร็วกว่านี้
- **ลื่นไหลไม่มี breakpoint (360 → 1440px):** `.page` กว้างสุด 1240px (`--shell`) · เว้นขอบ `--gutter` = `clamp(16px,4vw,40px)` · ตัวหนังสือใช้ `clamp()` · แบ่งสองคอลัมน์ด้วย `.split` (`repeat(auto-fit, minmax(min(100%,380px),1fr))`) ซึ่งยุบเป็นคอลัมน์เดียวเองบนมือถือ — **ห้ามเพิ่ม `@media (min-width:…)` เพื่อจัดเลย์เอาต์** (media query ที่เหลือมีแค่ hover · reduced-motion · print)
  - `.page--narrow` 620px (404 · error · หน้า login แอดมิน) · `.page--admin` 1080px
  - tap target ปุ่มหลัก ≥66px · เผื่อ `env(safe-area-inset-bottom)`
- **โครงทุกหน้าของนักเรียน:** `components/Shell.tsx` = `SiteHeader` (แถบ sticky + โลโก้เข็มทิศ + tab pill) → `<main className="page">` → `SiteFooter` · หน้า play ส่ง `nav={false}` เพื่อไม่ให้กดออกกลางเกม (มีปุ่ม Exit ที่ถามก่อนอยู่แล้ว) · `/admin` ไม่ใช้ Shell (มี `AdminNav` ของตัวเอง)
- **พื้นหลังทุกหน้า** = ครีม + จุด `radial-gradient(var(--dot) 1.5px, transparent 1.6px)` ขนาด 26px อยู่ที่ `body` **อย่าเอาออก**
- **โลโก้มี 2 แบบ อย่าใช้สลับกัน:**
  - `public/little-fox-logo.png` = โลโก้เต็ม (จิ้งจอก + ชื่อโรงเรียน) ใช้ **ตั้งแต่ 96px ขึ้นไป** — คลาส `.logo` / `.join__badge` · หน้าแรก · 404 · โปสเตอร์ QR
  - `public/little-fox-mark.png` = หัวจิ้งจอกในวงแหวน ใช้ **ที่เล็กกว่า 64px** — `.brand__mark` บนแถบ header (44px) และเป็นไอคอนแท็บ เพราะโลโก้เต็มย่อแล้วอ่านไม่ออก
  - `public/little-fox-logo-print.png` = โลโก้เต็ม 256px ทับพื้นขาว **ใช้ในไฟล์ PDF เท่านั้น** (ดูเหตุผลที่หัวข้อ Certificate)
  - ทั้งคู่ + ไอคอนใน `app/` **สร้างจาก `brand/little-fox-logo-master.png` ด้วย `npm run brand`** — เปลี่ยนแบรนด์ = วาง master ใหม่แล้วรันคำสั่งนี้ **อย่าแก้ไฟล์ปลายทางด้วยมือ**
  - รูปทุกใบใช้ `next/image` (ESLint ห้าม `<img>`) · โลโก้ในภาพมีวงแหวน/พื้นครีมของตัวเองอยู่แล้ว **อย่าครอบวง dashed ซ้อนอีก**
- **`prefers-reduced-motion`** ตัด transform/loop/shake เหลือแต่ fade — มีอยู่ท้าย globals.css แล้ว **อย่าลบ**

**จุดที่ตั้งใจไม่ทำตาม design doc** (design เดิมออกแบบมาสำหรับกติกาที่ต่างจากของเรา):
- doc มี pill "try again" = ให้ลองใหม่ · **ของเราตอบครั้งเดียว** จึงโชว์เฉลยแทน (กติกาอันดับต้องเทียบกันได้)
- doc นับเวลาถอยหลัง ("LEFT") · **ของเรานับขึ้น** เพราะเวลาใช้เป็นตัวตัดสินเสมอในลีดเดอร์บอร์ด
- `streak` ใน HUD เป็น **แค่การแสดงผล** ไม่เก็บลง DB ไม่คิดอันดับ
- กรอบรูปในคำถาม (mock มี "PHOTO · …") **ทำแล้วเฉพาะ `unscramble`** ผ่านฟิลด์ `art` — เกมชนิดอื่นยังไม่มีช่องรูป · ระบบ badge ก็ยังไม่มี
- mock มี **ปุ่มเลือกห้อง P4/1 · P4/2** และตัวเลข "24 explorers played today" · **ของเราไม่มีห้อง** และไม่โชว์สถิติปลอม — ช่อง fact บนหน้าแรกใช้เลขจริงจาก `listUnits()` แทน
- mock มี **หน้า Certificate เต็มหน้าจอ** (พรีวิว + Download PNG + Print) · ของเรายังเป็นปุ่มโหลด PDF ผ่าน `lib/certificate.ts` เหมือนเดิม (ถ้าจะทำหน้านี้คืองานฟีเจอร์ ไม่ใช่งานดีไซน์)
- **podium 3 อันดับแรก** บนลีดเดอร์บอร์ดตั้ง `aria-hidden` ไว้ เพราะข้อมูลซ้ำกับ `<ol className="board">` ข้างล่างที่เป็นตัวจริงของ screen reader (เทสจึงต้องใช้ `findAllByText` กับชื่อ 3 อันดับแรก)

## สไตล์โค้ด / naming

- TypeScript **strict เต็ม** — นิยาม type/interface ใน `lib/types.ts` ก่อนเสมอ
- คอมโพเนนต์ = **PascalCase** (`QuizChoice.tsx`) · โมดูล lib = ตัวเล็ก (`supabase.ts`)
- id ของยูนิต/ชนิดเกม = **kebab-case** (`unit-02`, `sentence-builder`) · โฟลเดอร์ route = kebab-case
- **`eslint.config.mjs` (flat config)** = `eslint-config-next/core-web-vitals` เฉยๆ — ไม่มี `.eslintrc.json` แล้ว (ESLint 9)
  - กฎใหม่ `react-hooks/set-state-in-effect` (มากับ react-hooks 7 ใน Next 16) **ปิดเฉพาะ 5 ไฟล์** ที่จำเป็นต้อง setState ใน effect จริง (อ่าน `localStorage` หลัง mount ไม่งั้น SSR ไม่ตรง · ยิง query ตอน mount · นับคะแนนขึ้น) เหตุผลเขียนไว้ในไฟล์ config แล้ว — **ไฟล์อื่นกฎยังทำงานอยู่ อย่าปิดทั้งโปรเจกต์**
- ยังไม่มี `.prettierrc` · `next.config.js` มีแค่ file tracing
- ท้ายไฟล์นี้มีบล็อก **BEGIN:nextjs-agent-rules** ที่ `next dev` เขียนกลับมาเองทุกครั้ง (ปิดได้ด้วย `agentRules: false` ใน next.config) — ลบไปก็ขึ้นใหม่ ปล่อยไว้เถอะ
  ⚠️ **ห้ามพิมพ์ marker ตัวเต็ม (มี `<!--` ครอบ) ที่อื่นในไฟล์นี้** — `next dev` จะนึกว่าบล็อกเริ่มตรงนั้นแล้วเขียนทับข้อความข้างล่างทิ้งทั้งหมด (เคยโดนมาแล้ว)

---

## หมายเหตุสถานะ

**ระบบเสร็จครบทุกหน้า + ลงดีไซน์ + ต่อ Supabase จริงแล้ว** (เทส 235 ตัว: 171 unit + 64 DB)

| ยูนิต | เนื้อหา | ข้อ / คะแนนเต็ม |
|-------|---------|-----------------|
| `unit-01` **Shadow Animal Challenge** | unscramble 30 ข้อ · เงาเป็น **emoji** (PDF Part 1 ครบทั้งไฟล์) | 30 / 300 |
| `unit-02` **Shadow Animals with Pictures** | unscramble 10 ข้อ · **ภาพวาดจริงทุกข้อ** (ชุดคำของครู · POLAR BEAR ซ้ำ 2 ข้อ ใช้คนละรูป) | 10 / 100 |
| `unit-03` **Guess the Animal** | quiz-choice 30 ข้อ (ต้นฉบับ 5 + แต่งเพิ่ม 25) | 30 / 300 |
| `unit-04` **Animal Sounds and Sentences** | quiz เสียงสัตว์ 5 + เรียงประโยค 30 (ต้นฉบับ 5 + แต่งเพิ่ม 25) | 35 / 350 |
| `unit-05` **Mythological Creatures** | listening 9 ข้อ (**วิดีโอ 6** + อ่าน 3) + writing 17 หัวข้อ (spirit animal 7 + Speaking Time 10) | 9 / 90 |

> ยูนิตถูกแยกตาม part ของ PDF **โดยตั้งใจ** — เอนจินบันทึกคะแนนตอนจบยูนิตครั้งเดียว ถ้ายัดรวมเป็นยูนิตเดียว 114 ข้อ เด็กที่เล่นไม่จบจะไม่ได้คะแนนเลย

**สิ่งที่แก้จากต้นฉบับ PDF (ตั้งใจ · อย่าแก้กลับ):**
- Part 1 ข้อ 26 **BUTTERFLY**: ต้นฉบับเขียน `RUBYTLTETF` (10 ตัว มี T สามตัว) ซึ่งเรียงเป็น BUTTERFLY ไม่ได้ → ใช้ `RUBYTLTEF` · เทส "anagram จริง" จับให้ทุกยูนิต
- Writing ช่องที่ 8 ของต้นฉบับ (`It is ___`) ซ้ำกับช่องที่ 2 → ตัดออก
- ตัวเลือกข้อ Fairy ต้นฉบับพิมพ์ `A / B / D` (ข้าม C) → แก้เป็น A/B/C
- `I am mini human with wings` → เติม article เป็น `I am a mini human with wings`

**เหลืองานเนื้อหา:** ไฟล์เสียง mp3 ของ listening (ตอนนี้ 3 ข้อที่ไม่มีวิดีโอใช้ TTS) · ยูนิตอื่นๆ เพิ่มเติม

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
