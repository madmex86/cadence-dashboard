const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const payload = {
    fake_column_check: 1
  };
  const { error } = await supabase.from('printers').insert(payload);
  console.log('Error:', error);
}
test();
