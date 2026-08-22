import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env')

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  console.warn('⚠️ File .env not found, using environment variables.')
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.')
  process.exit(1)
}

// We can use the anon key for testing, or if RLS is enabled we need the service role key or user auth.
// Wait, the edge function used SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
// In a local script, we might not have a service role key. Let's see if we can use the admin email/password
// to login first, or just tell the user to add SUPABASE_SERVICE_ROLE_KEY to .env.
// Since it's a local admin script, providing VITE_SUPABASE_SERVICE_KEY is best.
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('🔄 Fetching data from azs.astrobl.ru...')
  try {
    const response = await fetch('https://azs.astrobl.ru/')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const html = await response.text()
    
    console.log('📄 Parsing HTML...')
    const $ = cheerio.load(html)
    const stations = []
    
    let currentCategory = 'city'

    // We can iterate over portlet cards
    $('.portlet.portlet-border.portlet-hover.p-4').each((_, card) => {
      const cardEl = $(card)
      
      // Extract station number from "АЗС №XX"
      const titleText = cardEl.find('.title').text().trim()
      const stationMatch = titleText.match(/АЗС\s*№\s*(\S+)/)
      if (!stationMatch) return
      const stationNumber = stationMatch[1]

      // Extract brand
      const logoSrc = cardEl.find('img[src*="logos/"]').attr('src') || ''
      let brand = 'Другая'
      if (logoSrc.includes('lukoil')) brand = 'Лукойл'
      else if (logoSrc.includes('gazprom')) brand = 'Газпром'

      // Extract status
      const statusText = cardEl.find('.badge-success, .badge-danger').text().trim()
      let isWorking = statusText === 'Открыта'

      // Extract address
      const address = cardEl.find('.text-secondary.text-break').text().trim()

      // Extract working hours
      let startTime = null
      let endTime = null
      
      const timeLabel = cardEl.find('em.text-secondary').filter((_, el) => $(el).text().includes('Время работы:'))
      if (timeLabel.length) {
        const timeText = timeLabel.parent().find('span.fs-5').text()
        const startMatch = timeText.match(/с\s+(\d{1,2}:\d{2})/)
        const endMatch = timeText.match(/по\s+(\d{1,2}:\d{2})/)
        if (startMatch) startTime = startMatch[1]
        if (endMatch) endTime = endMatch[1]
        
        // If we found working hours, it operates today, so mark as working
        if (startTime && endTime) {
          isWorking = true
        }
      }

      // Extract coordinates
      let lat = null
      let lon = null
      const yandexLink = cardEl.find('a[href*="yandex.ru/maps"]').attr('href') || ''
      const coordMatch = yandexLink.match(/ll=([0-9.]+)%2C([0-9.]+)/)
      if (coordMatch) {
        lon = parseFloat(coordMatch[1])
        lat = parseFloat(coordMatch[2])
      }

      // Extract fuel types
      const fuelTypes = []
      cardEl.find('.list-inline-item.benz span').each((_, el) => {
        const fuel = $(el).text().trim()
        if (fuel) fuelTypes.push(fuel)
      })

      // Determine category by address
      let category = 'district'
      if (
        address.includes('г. Астрахань') ||
        address.includes('пригород') ||
        address.includes('Пригородный')
      ) {
        category = 'city'
      }

      stations.push({
        station_number: stationNumber,
        brand,
        address,
        category,
        lat,
        lon,
        fuel_types: fuelTypes,
        is_working: isWorking,
        start_time: startTime,
        end_time: endTime,
      })
    })

    console.log(`✅ Parsed ${stations.length} stations. Upserting into Supabase...`)
    
    const today = new Date().toISOString().split('T')[0]
    let stationsUpserted = 0
    let workHoursUpserted = 0
    
    for (const s of stations) {
      // Upsert station
      const { data: stationData, error: stationError } = await supabase
        .from('stations')
        .upsert(
          {
            station_number: s.station_number,
            brand: s.brand,
            address: s.address,
            category: s.category,
            lat: s.lat,
            lon: s.lon,
            fuel_types: s.fuel_types,
          },
          { onConflict: 'station_number' }
        )
        .select('id')
        .single()

      if (stationError) {
        console.error(`❌ Error upserting station ${s.station_number}:`, stationError.message)
        continue
      }

      stationsUpserted++
      const stationId = stationData.id

      // Upsert work hours
      const { error: whError } = await supabase.from('work_hours').upsert(
        {
          station_id: stationId,
          date: today,
          is_working: s.is_working,
          start_time: s.start_time,
          end_time: s.end_time,
        },
        { onConflict: 'station_id,date' }
      )

      if (whError) {
        console.error(`❌ Error upserting work hours for ${s.station_number}:`, whError.message)
      } else {
        workHoursUpserted++
      }
    }

    console.log('🎉 Done!')
    console.log(`- Stations upserted: ${stationsUpserted}`)
    console.log(`- Work hours records upserted for today (${today}): ${workHoursUpserted}`)
    
  } catch (err) {
    console.error('❌ Error during parsing:', err)
  }
}

run()
