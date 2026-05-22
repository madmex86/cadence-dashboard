const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const payload = { name: "Test Printer" };
  const { error } = await supabase.from('printers').insert(payload);
  console.log('Error with just name:', error);
}
test();
