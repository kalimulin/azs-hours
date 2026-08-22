import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase URL и Anon Key должны быть указаны в переменных окружения (.env файл)',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
