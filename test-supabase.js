const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('inventory').select('*').limit(1);
  console.log('Columns:', data && data[0] ? Object.keys(data[0]) : 'No data');
  if (error) console.error(error);
}
test();
