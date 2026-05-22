const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('printers').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    // try to get columns by just reading them if data exists, otherwise we just try an insert
    const payload = { name: "temp", type: "temp", status: "idle", current_job: null, ip_address: null };
    const { error: err2 } = await supabase.from('printers').insert(payload);
    console.log('Insert Test:', err2 ? err2.message : 'Success');
  }
}
test();
