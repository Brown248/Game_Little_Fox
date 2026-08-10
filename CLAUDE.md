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
npm test         # vitest — 203 เทส (logic + คอมโพเนนต์ ใน jsdom) ไม่ต้องมีอะไรรันอยู่
npm run test:db  # vitest — 64 เทส ยิง Postgres + PostgREST จริงใน docker (ดู tests/README.md)
npm run brand    # สร้างไฟล์โลโก้ทุกขนาดใหม่จาก brand/little-fox-logo-master.png
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
components/            Shell (SiteHeader + main + SiteFooter) · StartForm (ชื่ออย่างเดียว) · PlayClient (engine loop) · RankBoard (บอร์ด + ใบเซอร์) · MyScores (ประวัติ + ออกใบซ้ำ) · ConfirmDialog · Failure
components/games/      คอมโพเนนต์มินิเกม 5 แบบ + ตัวช่วยที่ใช้ร่วม: ChoiceList (A/B/C/D + seal/burst) · Progress (หัวข้อ+แทร็ก) · Feedback
components/admin/      AdminLogin · AdminNav · PlayersTable · MergePlayers · AttemptsTable · SetupNotice · PrintButton
lib/                   ดูตารางข้างล่าง
content/units/         นิยามยูนิตเป็นไฟล์ JSON + `_template.json` + `README.md` (กติกาการเขียนยูนิต)
public/audio/          ไฟล์เสียง — path ใน JSON เป็น relative แล้วต่อ prefix `/audio/` ให้ (URL เต็มก็ใส่ได้)
brand/                 ต้นฉบับโลโก้ (`little-fox-logo-master.png`) — ไฟล์เดียวที่เป็น "ของจริง"
scripts/               `build-brand-assets.mjs` = ตัดโลโก้ทุกขนาดจาก master (`npm run brand`)
supabase/schema.sql    DDL + RLS ของ Postgres (รันครั้งเดียวตอนตั้ง · re-run ได้)
tests/                 unit + component (jsdom) · tests/db = integration กับ Postgres จริง (ดู tests/README.md)
```

**หน้าที่ของแต่ละ lib:**

| ไฟล์ | ฝั่ง | หน้าที่ |
|------|-----|---------|
| `types.ts` | ทั้งสอง | type ทั้งโปรเจกต์ **นิยามที่นี่ก่อนเสมอ** (รวม shape ของ admin summary เพื่อให้ client import ได้) |
| `game.ts` | **server-only** | `GAME_ID` + `buildGame()` = ต่อ `games` ของทุกยูนิตเป็นเกมเดียว |
| `progress.ts` | client | เซฟ/อ่าน/ล้างรอบที่เล่นค้างไว้ใน `localStorage["we.progress"]` |
| `site.ts` | ทั้งสอง | ชื่อเว็บ + คำอธิบาย 1 บรรทัด — `layout.tsx` กับ `manifest.ts` อ่านที่เดียวกัน (เคยพิมพ์ซ้ำคำต่อคำ) |
| `format.ts` | ทั้งสอง | `formatTime` `formatPercent` `formatDateTime` `formatDate` `gameLabel`/`GAME_LABELS` · `parsePartId`/`scoreIdLabel` (อ่านเฉพาะ id เก่า) · `earnsCertificate`/`certificateNeeds`/`CERTIFICATE_PASS_MARK` — **ต้อง client-safe** |
| `supabase.ts` | client | anon client + query ของนักเรียน (`findOrCreatePlayer` `saveAttempt` `getPlayerAttempts` `getUnitRanking` `getOverallRanking`) |
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
| `/` | `app/page.tsx` | **กรอกชื่ออย่างเดียว** แล้ว `push` ไป `/play` ทันที |
| `/play` | `app/play/page.tsx` | **เกมเดียว ไม่มี segment ไม่มี query** — ส่ง `buildGame()` ให้ `PlayClient` |
| `/rank` | `app/rank/page.tsx` | บอร์ดเดียว (อันดับ · ชื่อ · คะแนน · เวลา) + ใบเซอร์ · **เป็นปลายทางของเกมที่เล่นจบด้วย** |
| `/me` | `app/me/page.tsx` | ประวัติของนักเรียนเอง + **โหลด certificate ซ้ำ** (query ฝั่ง client เพราะ id อยู่ใน localStorage) |
| `/leaderboard/overall` | `app/leaderboard/overall/page.tsx` | `redirect("/rank")` เฉยๆ — กันลิงก์เก่าพัง |
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

## เกมเดียว — โครงที่สำคัญที่สุดในโปรเจกต์ตอนนี้

ครูสั่งตัดการ "เลือก" ออกทั้งหมด: **ใส่ชื่อ → เริ่มข้อแรก → จบแล้วโชว์อันดับ**
ไม่มีหน้าเลือกยูนิต ไม่มีเลือก Part ไม่มี `/units` ไม่มี `/play/[unitId]` ไม่มี `?part=` อีกแล้ว

- **`buildGame()` ใน `lib/game.ts`** = `loadAllUnits().flatMap(u => u.games)` — เรียงตาม id ของยูนิต
  แล้วตามลำดับใน `games` ของแต่ละไฟล์ · **เพิ่ม `unit-03.json` = ต่อท้ายเกมเองอัตโนมัติ ไม่ต้องแตะโค้ด**
- **ยูนิตยังเป็นวิธีเขียนเนื้อหาเหมือนเดิม** (ตรงกับใบงานกระดาษของครู) แค่ไม่ใช่สิ่งที่เด็กต้องเลือกแล้ว

### `GAME_ID = "game-02"` — อ่านให้จบก่อนแก้
- **ทุก attempt ใหม่บันทึกลง `unit_id` ด้วยค่านี้** และบอร์ดคือ `getUnitRanking(GAME_ID)` อันเดียว
- **ตั้งใจให้ไม่ตรงรูป `unit-NN`** เพราะ `v_overall_ranking` ใน `supabase/schema.sql:66` กรอง
  `where r.unit_id ~ '^unit-[0-9]{2}$'` — คะแนนเก่า (`unit-01` · `unit-02` · `unit-NN-part-N`)
  จึงอยู่บนบอร์ดเดิมของมัน **ไม่ปนกับบอร์ดใหม่** ตามที่ครูสั่ง
- ⚠️ **ห้ามเปลี่ยน `GAME_ID` ให้เป็นรูป `unit-NN`** ไม่งั้นคะแนนคนละชุดเนื้อหาจะมาแข่งกัน
- **แก้เนื้อหาจนจำนวนข้อเปลี่ยน = bump เป็น `game-02`** เพื่อเปิดบอร์ดใหม่
  (คะแนนเทียบกันได้เฉพาะเมื่อมาจากชุดคำถามเดียวกัน)
- **ไม่ได้แก้ `schema.sql` เลยแม้แต่บรรทัดเดียว** — `npm run test:db` 64 เทสยังผ่านโดยไม่ต้องแตะ
  และไม่มีการ `UPDATE` แถวเก่า ข้อมูลจริงของเด็กจึงปลอดภัย

### ปุ่มย้อนกลับ — `router.replace` ไม่ใช่ `push`
จบเกม → บันทึก → **`router.replace("/rank")`** ⇒ `/play` หลุดออกจากประวัติ
กด back จากหน้าอันดับจึงไปโผล่ที่ `/` ตามที่ครูสั่ง ("พอกดย้อนกลับควรไปหน้าเริ่มต้นเลยคือหน้าใส่ชื่อ")
**ถ้าเปลี่ยนเป็น `push` เมื่อไหร่ บั๊กเดิมกลับมาทันที** — เด็กกด back แล้วเดินเข้าเกมที่เล่นจบไปแล้วและเริ่มใหม่
· เทสใน `engine.test.tsx` ล็อกไว้แล้ว

### ปุ่ม "Finish" — ออกจากเกมแล้วเก็บคะแนน ไม่ใช่ทิ้ง
เกมเป็นรอบเดียว 62 ข้อ แต่ห้องเรียนไปถึงทีละ Part — **เด็กที่เรียนถึงแค่ Part แรกจะเจออีก 35 ข้อ
ที่ยังไม่ได้เรียน** ถ้าปิดแท็บหนีก็ไม่ได้คะแนนเลย ปุ่ม `Exit` เดิมที่ทิ้งทั้งรอบจึงกลายเป็น **`Finish`**
- กด → ถาม `Finish here?` → **บันทึกเท่าที่ตอบไปแล้ว** → `/rank` (เส้นทางเดียวกับเล่นจบ)
- **ยังไม่ตอบสักข้อ = ไม่บันทึก** กลับหน้าแรกเฉยๆ (กันแถว 0/0 บนบอร์ด)
- บันทึกรอบสั้นไม่มีข้อเสีย เพราะบอร์ดเอา **ผลดีที่สุด** รอบที่แย่กว่าไม่เคยไปแทนที่รอบที่ดีกว่า
- ⚠️ **บอร์ดเรียงด้วยคะแนนดิบ** คนที่หยุดที่ 27 ข้อ (เต็ม 270) จึงไม่มีทางขึ้นเหนือคนที่ทำครบ 62 ข้อ
  (เต็ม 620) — **ยอมรับข้อนี้แล้ว** เพราะเล่นซ้ำได้ พอเรียนเพิ่มแล้วกลับมาเล่นใหม่คะแนนก็ขยับเอง
- ปุ่มบนหัวชื่อ `Finish` · ปุ่มยืนยันในกล่องชื่อ **`Finish now`** — ตั้งใจให้ชื่อไม่ซ้ำกัน

### เล่นค้างไว้ได้ (`lib/progress.ts`)
เกมเดียว 62 ข้อ ~15–25 นาที และคะแนนบันทึกตอนจบ **ครั้งเดียว** — ปิดแท็บตอนข้อ 90 คือเสียทั้งหมด
ครูอยากให้เด็กเล่นที่บ้านด้วย จึง **เซฟทุกครั้งที่จบ 1 ช่วง** ลง `localStorage` แล้วถามว่า "เล่นต่อ / เริ่มใหม่"
- **เซฟรายช่วง ไม่ใช่รายข้อ** — เลขข้ออยู่ใน state ภายในของเกมทั้ง 5 ตัว ดึงออกมาไม่คุ้ม
- **`ScoringState.accumulatedSeconds`** ทำให้นาฬิกานับเฉพาะเวลาที่เล่นจริง
  ไม่งั้นเด็กที่ปิดแท็บไปนอนจะได้เวลา 8 ชั่วโมง · `resumeScoringState()` เป็นตัวต่อเวลาให้
- ทิ้ง progress ทันทีที่ `saveAttempt` สำเร็จ และตอนกด Exit

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
| `unscramble` | `Unscramble.tsx` | เรียงตัวอักษรเป็นคำ · โชว์**อิโมจิสีปกติ** (ไม่ใช่เงา ดูหัวข้อฟีดแบ็กครู) |
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
- **บอร์ดเดียว** = `v_unit_ranking` กรองด้วย `GAME_ID` → **ผลดีที่สุดต่อคน** (คะแนนสูงสุด · เสมอตัดด้วยเวลาที่เร็วกว่า)
  เล่นซ้ำได้ เก็บทุกรอบ แต่ขึ้นบอร์ดแค่รอบที่ดีที่สุด (คำสั่งครู)
- **ห้าม re-sort ฝั่ง client** — ลำดับที่ view ให้มา *คือ* กติกา
- `v_overall_ranking` **ยังอยู่ในฐานข้อมูลแต่ฝั่งนักเรียนเลิกใช้แล้ว** (มันนับ "กี่ยูนิต" ซึ่งไม่มีความหมายอีก)
  **อย่าลบ view หรือ index ทิ้ง** — `tests/db/schema.test.ts` เช็คว่ามีจริง และ `npm run check:db` ก็เช็ค

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

- **Listening:** ถ้าไม่มี `audioUrl` (หรือโหลดไฟล์ไม่ได้) จะ fallback ไป browser TTS · path relative ใน JSON จะถูกต่อ prefix `/audio/` · ใส่ URL เต็มของ Supabase Storage ก็ได้ · **Part D ข้อ 1–7 มี mp3 จริงแล้ว · ข้อ 8–10 ยังใช้เสียงเครื่อง** (ข้อ 10 ที่เคยซ้ำข้อ 2 เปลี่ยนเป็น Mermaid แล้ว)
- **Writing:** เก็บแค่ "ทำเสร็จ" ไม่เก็บข้อความที่พิมพ์ (ตั้งใจ) และไม่คิดคะแนน
- **ใบเซอร์ตัดสินจาก "รอบที่เล่นจบที่ดีที่สุด" ไม่ใช่ "รอบที่คะแนนสูงสุด"** (`certificateRun` ใน `RankBoard.tsx`)
  เล่นครบ 62 ข้อถูก 35 = ได้ใบ · กลับมาเล่นใหม่ตอบ 50 ข้อแล้วกด Finish = คะแนนสูงกว่าแต่เล่นไม่จบ
  ถ้าเลือก "คะแนนสูงสุด" ใบเซอร์ที่ได้ไปแล้วจะถูกริบคืน **ห้ามเปลี่ยนกลับ**
- **`warmCertificate()` ต้องถูกเรียกตอนปุ่มโผล่ ไม่ใช่ตอนกด** — iOS Safari ไม่ยอมเริ่มดาวน์โหลด
  จาก handler ที่ไปรอ network ก่อน (นี่คือสาเหตุที่เป็นไปได้ของ "โหลดไม่ได้ ต้องเเคปเอา")
- **ใครได้ certificate:** ต้อง **เล่นครบทั้งเกม** (กด Finish กลางคันไม่ได้) **และตอบถูก ≥ ครึ่งหนึ่งของจำนวนข้อ**
  ⚠️ เงื่อนไข "ครบ" คือพารามิเตอร์ `fullQuestionCount` ของ `earnsCertificate()` — **ห้ามลืมส่ง**
  ไม่งั้นเด็กที่ทำ 20 จาก 27 ข้อแล้วกด Finish จะได้ 74% แล้วคว้าใบเซอร์ไปทั้งที่เล่นแค่ 1 ใน 3 ของเกม
  (`app/rank/page.tsx` นับจาก `buildGame()` แล้วส่งลงมาให้ `RankBoard`) · `playedItAll()` ใช้แยกข้อความ
  ระหว่าง "ยังเล่นไม่ครบ" กับ "ถูกไม่ถึงครึ่ง" — นับจาก `correctCount / totalQuestions` **ไม่ใช่คะแนนดิบ** (วันนี้ค่าเท่ากันเพราะข้อละ 10 แต่ถ้าคะแนนต่อข้อเปลี่ยน กติกาต้องยังอิงข้อถูก) · กติกาอยู่ที่ `earnsCertificate()` / `CERTIFICATE_PASS_MARK` ใน **`lib/format.ts`** ที่เดียว (ย้ายออกจาก `ResultScreen.tsx` ตอนเพิ่มหน้า `/me` เพราะสองหน้าออกใบแล้ว ห้ามให้เกณฑ์ต่างกัน) · ไม่ผ่านให้บอกว่าต้องถูกกี่ข้อ อย่าซ่อนปุ่มเฉยๆ
- **ในใบ certificate มี "ตรา" ได้อย่างเดียวคือโลโก้โรงเรียน** — เคยมี seal เข็มทิศทางขวา (ของเก่าจากตอนแบรนด์ยังเป็นเข็มทิศ) เอาออกแล้ว **ห้ามใส่ badge/seal/ภาพประกอบอะไรกลับเข้าไปอีก** เทส "draws no second emblem" กันไว้ (นับ addImage=1 · circle=0 · triangle=0)
- **Certificate:** A5 นอน · โลโก้บนหัว + กรอบส้ม + กรอบ dashed · `jspdf` ใช้ฟอนต์ built-in (Latin-1) → **ชื่อไทยจะออกมาเป็นสี่เหลี่ยม** ถ้าต้องรองรับต้อง embed ฟอนต์ไทย · หัวใบใช้ชื่อ **โรงเรียน** (`LITTLE FOX LANGUAGE SCHOOL`) ไม่ใช่ชื่อเกม เพราะคนออกใบคือโรงเรียน
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
| ground | `--page #FDF3E3` · `--edge #F3E4CE` · `--kraft #E2CDAE` | พื้นทุกหน้า · เส้นขอบการ์ด · แทร็กว่าง |
| marking | `--right #2F8F4E` · `--right-fill` · `--wrong #CF4436` · `--wrong-fill` | **ถูก = เขียว · ผิด = แดง** (คำสั่งครู) |
| surface | `--surface #FFF` · `--surface-warm #FFFCF6` | การ์ด · แผงซ้อนใน |
| ink | `--ink #2E2A26` · `--ink-soft #6B6155` · `--ink-mute` · `--ink-faint` | ตัวหนังสือไล่น้ำหนัก |

- **ฟอนต์ 3 ตัว:** Baloo 2 (`--font-display`) = หัวข้อ/ตัวเลข/ปุ่ม **ไม่ต่ำกว่า 20px** ·
  Nunito (`--font-text`) = เนื้อหา **ไม่ต่ำกว่า 17px** · IBM Plex Mono (`--font-mono`) = label เล็ก uppercase (คลาส `.kicker`)
- **spring เดียวทั้งระบบ:** `var(--spring)` = `cubic-bezier(.34,1.56,.64,1)` · hover `scale 1.02–1.06` · tap `0.94–0.97`
- **ปุ่มหลัก** (`.btn`) นั่งบนเงาแข็ง 8px · กดแล้ว `translateY(5px) scaleY(.96)` + เงาเหลือ 3px นี่คือลายเซ็นของงาน
- **ตอบถูก:** พื้น glow + seal เด้ง (`wePop`) + ring ขยายหายไป (`weBurst`) + คะแนนลอยขึ้น (`weRise`) รวมไม่เกิน 600ms
- **ตอบผิด:** สั่น 4 จังหวะ ±7px (`weShake`) + **พื้นแดง `--wrong-fill` ขอบ `--wrong`**
  ⚠️ **จงใจไม่ตาม design doc** — doc สั่งห้ามใช้แดงเพราะ "ไม่ลงโทษด้วยสี" แต่**ครูสั่งให้ใช้เขียว/แดงแบบที่ครูตรวจกระดาษ** เพราะเด็กอ่าน kraft เงียบๆ ว่า "ไม่มีอะไรเกิดขึ้น" → **ยึดครู** · ที่ยังคงไว้คือ **ห้ามหักคะแนน** และต้องโชว์เฉลยให้เสมอ
- **สีมาร์กใช้ที่:** `.choice--correct/--wrong` · `.feedback--correct/--wrong` · `.seal` · `.seal__burst` · `.float-points` — ทั้งหมดอิง token ไม่มีเลขดิบ
- **เลขที่เปลี่ยน** (คะแนน/เวลา/streak) ใส่ `key` แล้วให้คลาส `.tick` เล่น `weTick` 300ms
- **หน้าจอ/ข้อถัดไป** เลื่อนเข้า `weSlide` 260ms · ผลลัพธ์เข้าด้วย `.wipe-up` · ไม่ตัดภาพแข็งๆ
- **idle หายใจได้:** badge ลอย `weFloat` 7px รอบ 3–4.5s ห้ามเร็วกว่านี้
- **จอที่ต้องรองรับจริง: มือถือ 360–430 · iPad 768 (แนวตั้ง) / 1024 (แนวนอน) · คอม 1440** — ค่าที่วัดมาแล้ว อย่าแก้กลับ:
  - `.brand` ต้อง **ย่อได้** (`min-width: 0`) + `.brand__meta` ต้อง `text-overflow: ellipsis` —
    เคยเป็น `flex: none` แล้ว kicker ยาว 43 ตัวอักษรดันทั้งหน้าเลื่อนออกข้างบนมือถือ 360px ·
    kicker ของหน้า play จึงเหลือ `unit 02` เฉยๆ ไม่ต่อชื่อยูนิต
  - `.split` ใช้ track **330px** (ไม่ใช่ 380) เพื่อให้ **iPad แนวตั้ง 768px ได้ 2 คอลัมน์** —
    ที่ 380 มันแตกที่ ~854px คือ iPad ได้เลย์เอาต์เดียวกับมือถือทั้งที่มีที่ว่าง 707px
  - `.podium` ใช้ track **210px** ให้ 3 ใบเรียงแถวเดียวที่ 768px (ที่ 230 ใบที่ 3 ตกแถว)
  - `.tab` ต้องมี `min-height: 44px` · ลิงก์ข้อความใช้คลาส **`.textlink`** (44px) ห้ามใช้ `<a>` เปล่าในแถวปุ่ม
  - `viewportFit: "cover"` ใน `app/layout.tsx` คือตัวที่ทำให้ `env(safe-area-inset-*)` มีค่าจริงบน iOS **อย่าลบ**
- **ลื่นไหลไม่มี breakpoint (360 → 1440px):** `.page` กว้างสุด 1240px (`--shell`) · เว้นขอบ `--gutter` = `clamp(16px,4vw,40px)` · ตัวหนังสือใช้ `clamp()` · แบ่งสองคอลัมน์ด้วย `.split` (`repeat(auto-fit, minmax(min(100%,380px),1fr))`) ซึ่งยุบเป็นคอลัมน์เดียวเองบนมือถือ — **ห้ามเพิ่ม `@media (min-width:…)` เพื่อจัดเลย์เอาต์** (media query ที่เหลือมีแค่ hover · reduced-motion · print)
  - `.page--narrow` 620px (404 · error · หน้า login แอดมิน) · `.page--admin` 1080px
  - tap target ปุ่มหลัก ≥66px · เผื่อ `env(safe-area-inset-bottom)`
- **โครงทุกหน้าของนักเรียน:** `components/Shell.tsx` = `SiteHeader` (แถบ sticky + โลโก้เข็มทิศ + tab pill) → `<main className="page">` → `SiteFooter` · หน้า play ส่ง `nav={false}` เพื่อไม่ให้กดออกกลางเกม (มีปุ่ม Exit ที่ถามก่อนอยู่แล้ว) · `/admin` ไม่ใช้ Shell (มี `AdminNav` ของตัวเอง)
- **หน้าแรก (`.door` ใน globals.css)** — จอเดียวที่เด็กใช้ตัดสินว่าเกมนี้น่าเล่นไหม
  จิ้งจอกตัวใหญ่ตกลงมา (`weDrop`) แล้วลอย (`weFloat`) · มีแสงหลังตัวหายใจ (`weBreathe`) ·
  ฟองส้ม 4 ลูกลอยขึ้น (`weRiseSlow`) · **พอพิมพ์ชื่อ จิ้งจอกกระโดด 1 ที** (`weHop` — re-key ด้วย
  `key={String(ready)}` ใน React ไม่งั้น browser ไม่เล่นซ้ำ) · ปุ่ม Play เต้นเบาๆ (`weReady`)
  **ทุกลูปต้องอยู่ในลิสต์ `prefers-reduced-motion` ท้ายไฟล์** ไม่งั้นเด็กที่ตั้งค่าลดการเคลื่อนไหวจะโดนหมด
- **แถบบนมีแค่ 2 tab: `Play` กับ `Top scores` — ห้ามเพิ่ม** (เทส `tests/unit/chrome.test.tsx` ล็อกไว้)
  เคยมี Play · This unit · Top explorers แล้วหน้าลีดเดอร์บอร์ดยังมีแถวชิปให้เลือกซ้ำอีก ครูบอก "มีแถบไว้เล่น กับ ranking ก็พอแล้ว...เหมือนกันเกินไป"
  → **เลือกว่าจะดูบอร์ดไหน เป็นหน้าที่ของหน้าบอร์ดเอง** (แถวชิป `All units` / `unit NN` / `This part`) ไม่ใช่ของแถบบน · หน้า `/me` ไม่มี tab ของตัวเอง เข้าจากหน้าเลือกยูนิต · หน้าผลคะแนน · footer
- **พื้นหลังทุกหน้า** = ครีม + จุด `radial-gradient(var(--dot) 1.5px, transparent 1.6px)` ขนาด 26px อยู่ที่ `body` **อย่าเอาออก**
- **โลโก้มี 2 แบบ อย่าใช้สลับกัน:**
  - `public/little-fox-logo.png` = โลโก้เต็ม (จิ้งจอก + ชื่อโรงเรียน) ใช้ **ตั้งแต่ 96px ขึ้นไป** — คลาส `.logo` / `.join__badge` · หน้าแรก · 404 · โปสเตอร์ QR
  - `public/little-fox-mark.png` = หัวจิ้งจอกในวงแหวน ใช้ **ที่เล็กกว่า 64px** — `.brand__mark` บนแถบ header (44px) และเป็นไอคอนแท็บ เพราะโลโก้เต็มย่อแล้วอ่านไม่ออก
  - `public/little-fox-logo-print.png` = โลโก้เต็ม 256px ทับพื้นขาว **ใช้ในไฟล์ PDF เท่านั้น** (ดูเหตุผลที่หัวข้อ Certificate)
  - ทั้งคู่ + ไอคอนใน `app/` **สร้างจาก `brand/little-fox-logo-master.png` ด้วย `npm run brand`** — เปลี่ยนแบรนด์ = วาง master ใหม่แล้วรันคำสั่งนี้ **อย่าแก้ไฟล์ปลายทางด้วยมือ**
  - รูปทุกใบใช้ `next/image` (ESLint ห้าม `<img>`) · โลโก้ในภาพมีวงแหวน/พื้นครีมของตัวเองอยู่แล้ว **อย่าครอบวง dashed ซ้อนอีก**
- **`prefers-reduced-motion`** ตัด transform/loop/shake เหลือแต่ fade — มีอยู่ท้าย globals.css แล้ว **อย่าลบ**
- **ห้ามใช้ `window.confirm/alert/prompt`** — ใช้ `components/ConfirmDialog.tsx` แทนทุกที่ (สร้างบน `<dialog>` ได้ focus trap · Esc · backdrop ฟรี) · กล่องของเบราว์เซอร์จัดสไตล์ไม่ได้และขึ้นชื่อโดเมนแบบน่าตกใจกลางคาบเรียน · jsdom ไม่มี `showModal()` เลยมี shim ใน `tests/setup.ts` **อย่าไปใส่ guard ในคอมโพเนนต์**

**จุดที่ตั้งใจไม่ทำตาม design doc** (design เดิมออกแบบมาสำหรับกติกาที่ต่างจากของเรา):
- doc มี pill "try again" = ให้ลองใหม่ · **ของเราตอบครั้งเดียว** จึงโชว์เฉลยแทน (กติกาอันดับต้องเทียบกันได้)
- doc นับเวลาถอยหลัง ("LEFT") · **ของเรานับขึ้น** เพราะเวลาใช้เป็นตัวตัดสินเสมอในลีดเดอร์บอร์ด
- `streak` ใน HUD เป็น **แค่การแสดงผล** ไม่เก็บลง DB ไม่คิดอันดับ
- กรอบรูปในคำถาม (mock มี "PHOTO · …") **ทำแล้วเฉพาะ `unscramble`** ผ่านฟิลด์ `art` — เกมชนิดอื่นยังไม่มีช่องรูป · ระบบ badge ก็ยังไม่มี
- mock มี **ปุ่มเลือกห้อง P4/1 · P4/2** และตัวเลข "24 explorers played today" · **ของเราไม่มีห้อง** และไม่โชว์สถิติปลอม
  หน้าแรกตอนนี้เหลือแค่ช่องชื่อ + ปุ่ม + บรรทัดตัวเลขจริงจาก `listUnits()` (`2 units · 109 questions`)
- mock มี **หน้า Certificate เต็มหน้าจอ** (พรีวิว + Download PNG + Print) · ของเรายังเป็นปุ่มโหลด PDF ผ่าน `lib/certificate.ts` เหมือนเดิม (ถ้าจะทำหน้านี้คืองานฟีเจอร์ ไม่ใช่งานดีไซน์)
- **podium 3 อันดับแรก** บนลีดเดอร์บอร์ดตั้ง `aria-hidden` ไว้ เพราะข้อมูลซ้ำกับ `<ol className="board">` ข้างล่างที่เป็นตัวจริงของ screen reader (เทสจึงต้องใช้ `findAllByText` กับชื่อ 3 อันดับแรก)

## ภาษาบนหน้าจอ — กฎที่ครูสั่ง (มีเทสล็อกไว้)

**เด็ก ป.4 ไทย เป็นคนอ่าน** ครูสั่งหลังดูบนมือถือว่า "ตัวหนักสือเยอะเกินไปเด็กคงไม่อ่าน...
คำศัพท์ที่ใช้อธิบายต้องเป็นคำเบสิคเท่านั้น ไม่ใช้คำที่ยากไปเด็ดขาด"

**2 กฎ · `tests/unit/copy.test.tsx` เช็คทุกจอ:**
1. **ห้ามมีคำต้องห้าม** — `explorer` `expedition` `leaderboard` `scoreboard` `accuracy` `attempt`
   `dominate` `averaging` `streak` `unscramble` `responsive` `breakpoint` `credentials` `curiosity`
2. **ห้ามมีประโยคเกิน 12 คำ** — ย่อหน้าอธิบายถือว่าไม่มีใครอ่าน

| คำที่เลิกใช้ | ใช้แทน |
|---|---|
| explorer(s) | player(s) · หัวคอลัมน์ = `Name` |
| Top explorers | **Top scores** |
| expedition | game (หรือตัดทิ้ง) |
| leaderboard · scoreboard | scores |
| accuracy | **Right** (คู่กับ %) |
| ranking · overall | place · All units |
| streak | In a row |
| Unscramble | Make the word |

> **ยกเว้นข้อความที่มาจาก `content/units/*.json`** — ชื่อ Part (`Part D · Mythological Creatures`)
> กับคำใบ้เป็น**เนื้อหาบทเรียน** ต้องตรงกับใบงานกระดาษของครู **ห้ามแก้** · เทสไม่กวาดส่วนนี้
> **`certificate` เก็บคำไว้** เป็นชื่อของสิ่งที่เด็กได้จริง แต่ห้ามอยู่ในประโยคยาว

- **ข้อความ error ของนักเรียนเหลือประโยคเดียวที่ทำตามได้** (`No internet. Try again.` ฯลฯ) ·
  เหตุผลจริง (รหัส Postgres · ชื่อไฟล์ `.env`) **ต้องพับไว้ใน `<details>` หัวข้อ `For the teacher`**
  — ห้ามเอาออก มันคือตัวที่จับได้ว่า key ถูกวางผิดช่องคราวก่อน
- **กติกาการจัดอันดับอยู่ที่ `/admin` เท่านั้น** ห้ามเขียนกลับลงหน้าของนักเรียน (เคยเขียนซ้ำ 3 รอบในจอเดียว)
- ข้อความ "กำลังโหลด" ใช้ **`Please wait…`** อย่างเดียว (เคยมี 6 แบบ)

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

**ระบบเสร็จครบทุกหน้า + ลงดีไซน์ + ต่อ Supabase จริง + ผ่านการใช้จริงในห้องเรียนแล้ว** (เทส 282 ตัว: 218 unit + 64 DB)

**มี 2 ยูนิต ตามที่ครูยืนยัน** (เท่ากับ Unit 1 / Unit 2 ของใบงาน) — ยูนิตหนึ่งมีหลาย Part:

| ยูนิต | Part | ข้อ / คะแนนเต็ม |
|-------|------|-----------------|
| `unit-01` **Animal Words** | unscramble **อิโมจิสีปกติ** 27 ข้อ | **27 / 270** |
| `unit-02` **Wild Life and Wonderful Creatures** | B quiz 10 · C1 เสียงสัตว์ 5 · C2 เรียงประโยค **10** · D listening 10 (**mp3 7 ไฟล์** + อีก 3 ข้อใช้เสียงเครื่อง) · E writing 17 (ไม่คิดคะแนน) | **35 / 350** |

> ⚠️ **ยูนิตไม่ใช่สิ่งที่เด็กเลือกอีกแล้ว** — ทั้งสองไฟล์ต่อกันเป็น **เกมเดียว 62 ข้อ / 620 คะแนน**
> (ดูหัวข้อ "เกมเดียว" ข้างบน) · ยูนิตยังเป็นวิธีจัดระเบียบเนื้อหาให้ตรงกับใบงานของครูเหมือนเดิม

**สิ่งที่แก้ตามฟีดแบ็กครูหลังใช้จริง (ตั้งใจ · อย่าแก้กลับ):**
- **⚠️ Part 1 ไม่มี "เงา" แล้ว — อิโมจิโชว์สีปกติตั้งแต่เปิดข้อ** ครูสั่ง "ไม่เอา Shadow เอาแค่ภาพสีอิโมจิพอ"
  - ลบ `filter: brightness(0)` ออกจาก `.animal-emoji` (ชื่อเดิม `.shadow-animal`) · ตัดคำถาม
    "whose shadow is this?" · ฟิลด์ใน JSON เปลี่ยนชื่อจาก `shadow` เป็น **`emoji`** · unit-01
    เปลี่ยนชื่อจาก "Shadow Animal Challenge" เป็น **"Animal Words"**
  - Part นี้ถามว่า**สะกดคำยังไง** ไม่ได้ถามว่าตัวอะไร · เทส "shows the animal in colour straight
    away" ใน `games.test.tsx` ล็อกไว้ **ห้ามเอาเงากลับ**
- **⚠️ ไม่มี "ภาพวาดสัตว์" เหลือในโปรเจกต์แล้ว — ห้ามเอากลับ** ครูสั่ง
  "เอาพวกภาพที่ฉัน add เข้าไปอะพวกภาพสัตว์เอาออกให้หมด เอาแค่อิโมจิมาใน Part เเรก"
  - **ลบทิ้งหมด:** โฟลเดอร์ `public/images/` · `scripts/build-animal-images.mjs` · คำสั่ง `npm run images`
    · `animalArt()`/`ANIMAL_ART_DIR` ใน `lib/format.ts` · ฟิลด์ `art` ใน `UnscrambleItem` · CSS `.art`
  - **`sharp` ยังต้องอยู่** เพราะ `npm run brand` ใช้
  - **รูปเดียวที่คำถามมีได้คืออิโมจิใน `emoji`** · เทส "has no animal artwork anywhere" ใน `units.test.ts` กันไว้
  - เกมรวม **62 ข้อ / 620 คะแนน** (unit-01 27 + unit-02 35)
- **ทุกข้อที่มีตัวเลือกต้องมี 3 ตัวเลือกเป๊ะ — ห้ามเป็น 4** ครูไล่กากบาททิ้งทีละข้อเอง
  ("Part นี้มีแค่ 3 choice พอ") · เทส "offers exactly three choices" ใน `units.test.ts` ล็อกไว้
- **Part B เหลือ 10 ข้อจาก 30** — ครูเล่นจริงแล้วแคปมา 10 ข้อพร้อมไฮไลท์ตัวเลือกที่ไม่เอา
  แล้วสั่งว่า "เอาแค่ข้อที่มีในภาพพอ" · ที่ตัดออก 20 ข้อ: giraffe · tiger · duck · lion · monkey ·
  koala · camel · snake · owl · eagle · parrot · flamingo · blue whale · shark · crocodile ·
  wolf · rabbit · gorilla · bee · polar bear
  - (ก่อนหน้านี้เคยตัดสัตว์ออก 3 ตัวจาก Part 1 ตามรายชื่อครู — giraffe · flamingo · parrot)
- **ถูกเขียว ผิดแดง** (ดูหัวข้อดีไซน์)
- **เข้าเกมใน 1 แตะ** — `/` พิมพ์ชื่อ → `/play` ข้อแรกทันที · **ไม่มีจอเลือกอะไรเลย**
  (เคยมี `/unit/[unitId]` แล้วเหลือ `/units` แล้วตัดทิ้งทั้งคู่ตามคำสั่งครูรอบล่าสุด)
- **นาฬิกาติดจอตลอด** — `.hud` เป็น sticky แถบเดียว (คะแนน · In a row · เวลา) เกาะจาก **`--appbar-h`**
  ตัวแปรเดียวที่ `.appbar__in` (`min-height`) กับ `.hud` (`top`) ใช้ร่วมกัน — `.hud` เป็น `z-index 20` ส่วน `.appbar` เป็น `30`
  ถ้าแถบสูงเกินค่านี้เมื่อไหร่ **นาฬิกาจะมุดหายใต้แถบเงียบๆ** ห้ามแยกสองค่าออกจากกัน
- **หน้า `/me`** — ดูคะแนนย้อนหลังและโหลด certificate ซ้ำได้โดยไม่ต้องเล่นใหม่
- **แถบบนเหลือ 2 tab** (ดูหัวข้อดีไซน์)
- **Part C2 (เรียงประโยค): หัวข้อเหลือ "อิโมจิอย่างเดียว"** — เดิมเขียน `🐍 Hiss! Hiss!` ซึ่งบอกกริยาให้ฟรี = ครึ่งประโยคที่เด็กต้องแต่งเอง · คอมโพเนนต์เช็คว่า prompt ไม่มีตัวอักษร/ตัวเลขแล้วเรนเดอร์ใหญ่ด้วยคลาส `.q__emoji`
- **ตัดประโยคที่ใช้ `loudly` ออกทั้งหมด 5 ข้อ** (dog · lion · wolf · whale · parrot) · เทสใน `units.test.ts` ล็อกกฎทั้งสองข้อไว้
- **C2 เหลือ 10 ข้อ** — ครูเล่นจริงแล้วแคปหน้าจอมา 10 ใบ สั่งว่า "Part นี้เอาแค่นั้น 10 ข้อพอ"
  ที่เหลือคือ **snake · cow · bird · cat · duck · pig · sheep · frog · bee · ant** (เรียงตามภาพที่ครูส่ง)
  ตัดออก 15 ข้อ: owl · horse · fish · eagle · turtle · monkey · spider · rabbit · elephant ·
  panda · camel · penguin · tiger · deer · dolphin

**สิ่งที่แก้จากต้นฉบับ PDF (ตั้งใจ · อย่าแก้กลับ):**
- Part 1 ข้อ 26 **BUTTERFLY**: ต้นฉบับเขียน `RUBYTLTETF` (10 ตัว มี T สามตัว) ซึ่งเรียงเป็น BUTTERFLY ไม่ได้ → ใช้ `RUBYTLTEF` · เทส "anagram จริง" จับให้ทุกยูนิต
- Writing ช่องที่ 8 ของต้นฉบับ (`It is ___`) ซ้ำกับช่องที่ 2 → ตัดออก
- ตัวเลือกข้อ Fairy ต้นฉบับพิมพ์ `A / B / D` (ข้าม C) → แก้เป็น A/B/C
- `I am mini human with wings` → เติม article เป็น `I am a mini human with wings`

**เหลืองานเนื้อหา:** mp3 ของ Part D ข้อ 8–10 (Phoenix · Fairy · Mermaid) · ให้ครูฟังยืนยันคำใบ้ข้อ 7 (Yeti) · ยูนิตอื่นๆ เพิ่มเติม

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
