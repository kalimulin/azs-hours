import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ParsedStation {
  station_number: string
  brand: string
  address: string
  category: string
  lat: number | null
  lon: number | null
  fuel_types: string[]
  is_working: boolean
  start_time: string | null
  end_time: string | null
}

Deno.serve(async (req) => {
  try {
    // Fetch HTML from the AZS website
    const response = await fetch('https://azs.astrobl.ru/')
    const html = await response.text()

    const doc = new DOMParser().parseFromString(html, 'text/html')
    if (!doc) {
      return new Response(JSON.stringify({ error: 'Failed to parse HTML' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Determine current category by looking at section headers
    const stations: ParsedStation[] = []

    // Find all station cards
    const cards = doc.querySelectorAll('.portlet.portlet-border.portlet-hover.p-4')

    // Find category headers to determine which cards belong to which category
    const contentBody = doc.querySelector('.__content__body_main')
    let currentCategory = 'city'

    for (const card of cards) {
      const cardEl = card as unknown as Element

      // Extract station number from "АЗС №XX"
      const titleEl = cardEl.querySelector('.title')
      if (!titleEl) continue
      const titleText = titleEl.textContent?.trim() || ''
      const stationMatch = titleText.match(/АЗС\s*№\s*(\S+)/)
      if (!stationMatch) continue
      const stationNumber = stationMatch[1]

      // Extract brand from logo image
      const logoImg = cardEl.querySelector('img[src*="logos/"]')
      const logoSrc = logoImg?.getAttribute('src') || ''
      let brand = 'Другая'
      if (logoSrc.includes('lukoil')) brand = 'Лукойл'
      else if (logoSrc.includes('gazprom')) brand = 'Газпром'

      // Extract status
      const statusBadge = cardEl.querySelector('.badge-success, .badge-danger')
      const statusText = statusBadge?.textContent?.trim() || ''
      const isWorking = statusText === 'Открыта'

      // Extract address
      const addressEl = cardEl.querySelector('.text-secondary.text-break')
      const address = addressEl?.textContent?.trim() || ''

      // Extract working hours
      let startTime: string | null = null
      let endTime: string | null = null
      const timeLabel = cardEl.querySelector('em.text-secondary')
      if (timeLabel && timeLabel.textContent?.includes('Время работы:')) {
        const timeSpan = timeLabel.parentElement?.querySelector('span.fs-5')
        if (timeSpan) {
          const timeText = timeSpan.textContent || ''
          // Format: " с HH:MM, DD месяц \n по HH:MM, DD месяц"
          const startMatch = timeText.match(/с\s+(\d{1,2}:\d{2})/)
          const endMatch = timeText.match(/по\s+(\d{1,2}:\d{2})/)
          if (startMatch) startTime = startMatch[1]
          if (endMatch) endTime = endMatch[1]
        }
      }

      // Extract coordinates from Yandex Maps link
      let lat: number | null = null
      let lon: number | null = null
      const yandexLink = cardEl.querySelector('a[href*="yandex.ru/maps"]')
      if (yandexLink) {
        const href = yandexLink.getAttribute('href') || ''
        const coordMatch = href.match(/ll=([0-9.]+)%2C([0-9.]+)/)
        if (coordMatch) {
          lon = parseFloat(coordMatch[1])
          lat = parseFloat(coordMatch[2])
        }
      }

      // Extract fuel types
      const fuelTypes: string[] = []
      const fuelItems = cardEl.querySelectorAll('.list-inline-item.benz span')
      for (const item of fuelItems) {
        const fuel = (item as unknown as Element).textContent?.trim()
        if (fuel) fuelTypes.push(fuel)
      }

      stations.push({
        station_number: stationNumber,
        brand,
        address,
        category: currentCategory,
        lat,
        lon,
        fuel_types: fuelTypes,
        is_working: isWorking,
        start_time: startTime,
        end_time: endTime,
      })
    }

    // Determine categories by checking section headers in the page
    // The page has sections: "Город и пригород" and then districts
    // We'll use the address to infer category as a fallback
    // Actually, let's look for section headers in the parsed HTML
    const sectionHeaders = doc.querySelectorAll('.fs-2.fw-medium')
    const categoryBoundaries: { text: string; index: number }[] = []
    for (const header of sectionHeaders) {
      const text = (header as unknown as Element).textContent?.trim() || ''
      if (text.includes('Город и пригород') || text.includes('Район')) {
        categoryBoundaries.push({ text, index: 0 })
      }
    }

    // If we found district section, mark stations accordingly
    // For now, we use a simpler heuristic: stations with "г. Астрахань" in address are 'city'
    for (const s of stations) {
      if (
        s.address.includes('г. Астрахань') ||
        s.address.includes('пригород') ||
        s.address.includes('Пригородный')
      ) {
        s.category = 'city'
      } else {
        s.category = 'district'
      }
    }

    // Connect to Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

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
          { onConflict: 'station_number' },
        )
        .select('id')
        .single()

      if (stationError) {
        console.error(`Error upserting station ${s.station_number}:`, stationError)
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
        { onConflict: 'station_id,date' },
      )

      if (whError) {
        console.error(`Error upserting work hours for ${s.station_number}:`, whError)
      } else {
        workHoursUpserted++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        total_parsed: stations.length,
        stations_upserted: stationsUpserted,
        work_hours_upserted: workHoursUpserted,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
