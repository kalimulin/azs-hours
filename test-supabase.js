import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('Testing Supabase connection to:', supabaseUrl)
  
  // Test stations table
  const { data: stations, error: stationsError } = await supabase
    .from('stations')
    .select('count')
    .limit(1)
    
  if (stationsError) {
    console.error('❌ Error accessing "stations" table:', stationsError.message)
  } else {
    console.log('✅ Connected to "stations" table successfully.')
  }
  
  // Test work_hours table
  const { data: workHours, error: workHoursError } = await supabase
    .from('work_hours')
    .select('count')
    .limit(1)
    
  if (workHoursError) {
    console.error('❌ Error accessing "work_hours" table:', workHoursError.message)
  } else {
    console.log('✅ Connected to "work_hours" table successfully.')
  }
}

testConnection()
