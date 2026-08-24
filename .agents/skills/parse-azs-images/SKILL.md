---
name: parse-azs-images
description: >-
  Use this skill when the user asks to parse, recognize, or load images with AZS schedules (графики АЗС) and fill or update the Supabase database.
---

# Parse AZS Schedules from Images

This skill explains how to extract working hours from images containing AZS schedules and save them to the project's Supabase database.

## Project Technical Context

> Read this before writing any code — these details are critical and will cause errors if ignored.

- **Module system**: The project uses `"type": "module"` in `package.json`. Always use ES module syntax (`import`/`export`), **never** `require()`.
- **Environment variables**: Supabase credentials are in `.env` at the project root:
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_SERVICE_KEY` — service role key (preferred, bypasses RLS)
  - `VITE_SUPABASE_ANON_KEY` — fallback if service key is absent
- **Database schema** — two tables are used:
  - `stations` — upserted on conflict `station_number`. Fields: `station_number` (text), `brand` (text), `address` (text), `category` (text: `'city'` or `'district'`).
  - `work_hours` — upserted on conflict `station_id, date`. Fields: `station_id` (FK to stations.id), `date` (YYYY-MM-DD), `is_working` (bool), `start_time` (HH:MM), `end_time` (HH:MM).
- **Brand name casing**: Use title-case Russian: `'Лукойл'` and `'Газпром'` (not uppercase ЛУКОЙЛ/ГАЗПРОМ).
- **Category logic**: set `'city'` if address contains `'г. Астрахань'` or `'Пригородный'`; otherwise `'district'`.
- **Transient fetch errors** are common due to Supabase rate limiting. The script should retry each failed record up to 3 times with a short delay. All upserts are idempotent, so re-running the whole script is always safe.

## Steps

1. **Find the Images**: Use `list_dir` on `d:\code\azs-hours\data`. Process all images found.

2. **Read the Images**: Use `view_file` on each image. The tool loads the image into context for OCR.

3. **Understand the Schedule Structure**:
   - Date is shown at the top (e.g. `24.08.2026`) — convert to `YYYY-MM-DD`.
   - Table columns: `№ АЗС` (station number), `Адрес` (address), `Время работы` (working hours as `HH:MM-HH:MM`), `АЗС` (brand logo — ЛУКОЙЛ or ГАЗПРОМ).
   - The image may have a note like "ЧЁТНЫЕ НОМЕРА" or "НЕЧЁТНЫЕ НОМЕРА" — this is informational only, not stored.

4. **Create the Seed Script** at `scripts/seed-images.js` using the template below. Fill in `records` from the extracted image data.

5. **Run the Script**:
   ```
   node scripts/seed-images.js
   ```
   - Check output for any `❌ Error` lines.
   - If errors appear (fetch failed / rate limit), re-run — upserts are idempotent.
   - Acceptable final output: `Stations upserted: N` and `Work hours upserted: N` where N matches the number of records.

6. **Clean Up**:
   - Delete all processed images from `data/`.
   - Delete `scripts/seed-images.js`.

## Seed Script Template

```js
// scripts/seed-images.js
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// Fill this array with data extracted from the images.
// brand: 'Лукойл' or 'Газпром' (title-case)
// start/end: 'HH:MM'
const records = [
  // { date: '2026-08-24', st: '30655', brand: 'Лукойл', addr: 'с. Солянка, ул. Магистральная, 2А', start: '06:00', end: '08:00' },
]

async function upsertWithRetry(fn, label, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const { data, error } = await fn()
    if (!error) return data
    console.warn(`⚠️ Attempt ${i + 1} failed for ${label}: ${error.message}`)
    if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)))
  }
  console.error(`❌ All retries exhausted for ${label}`)
  return null
}

async function seed() {
  console.log(`Processing ${records.length} records...`)
  let stationsOk = 0, hoursOk = 0

  for (const r of records) {
    const category = (r.addr.includes('г. Астрахань') || r.addr.includes('Пригородный')) ? 'city' : 'district'

    const stationData = await upsertWithRetry(
      () => supabase.from('stations')
        .upsert({ station_number: r.st, brand: r.brand, address: r.addr, category }, { onConflict: 'station_number' })
        .select('id').single(),
      `station ${r.st}`
    )
    if (!stationData) continue
    stationsOk++

    const ok = await upsertWithRetry(
      () => supabase.from('work_hours')
        .upsert({ station_id: stationData.id, date: r.date, is_working: true, start_time: r.start, end_time: r.end }, { onConflict: 'station_id,date' }),
      `work_hours ${r.st} ${r.date}`
    )
    if (ok !== null) hoursOk++
  }

  console.log(`🎉 Done! Stations upserted: ${stationsOk}, Work hours upserted: ${hoursOk}`)
}

seed()
```
