const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const payload = { name: "temp", type: "temp", status: "idle" };
  const { error: err2 } = await supabase.from('printers').insert(payload);
  console.log('Insert Test:', err2 ? err2.message : 'Success');
}
test();
