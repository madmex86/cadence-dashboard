import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const config = fs.readFileSync('supabase/config.toml', 'utf8')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('scheduled_posts').select('*').limit(1)
  if (error) {
    console.error('Error fetching scheduled_posts:', error)
  } else {
    console.log('scheduled_posts row example:', data)
  }
}
run()
