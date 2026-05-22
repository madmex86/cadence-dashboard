const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const payload = {
    spool_name: "Test Spool",
    fake_column_xyz123: "Test",
  };
  const { data, error } = await supabase.from('inventory').insert(payload).select().single();
  console.error("Insert Error:", error);
}
test();
