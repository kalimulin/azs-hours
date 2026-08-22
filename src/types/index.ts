export interface Station {
  id: string
  station_number: string
  brand: string
  address: string
  category: 'city' | 'district'
  lat: number | null
  lon: number | null
  fuel_types: string[]
  created_at: string
}

export interface WorkHour {
  id: string
  station_id: string
  date: string // 'YYYY-MM-DD'
  is_working: boolean
  start_time: string | null // 'HH:MM'
  end_time: string | null // 'HH:MM'
  hours_worked: number
  created_at: string
}

/** Расширенные данные работы — с информацией об АЗС (для JOIN-запросов) */
export interface WorkHourWithStation extends WorkHour {
  station: Station
}

/** Сводка АЗС-часов за день */
export interface DailySummary {
  date: string
  total_azs_hours: number
}

/** Данные для ручного ввода часов работы */
export interface WorkHourEntry {
  station_id: string
  is_working: boolean
  start_time: string | null
  end_time: string | null
}
