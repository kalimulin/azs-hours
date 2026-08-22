import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testParse() {
  console.log('Invoking Edge Function: parse-azs...')
  const { data, error } = await supabase.functions.invoke('parse-azs', {
    method: 'POST'
  })
  
  if (error) {
    console.error('❌ Error invoking function:')
    console.dir(error, { depth: null })
  } else {
    console.log('✅ Function executed successfully!')
    console.log(data)
  }
}

testParse()
