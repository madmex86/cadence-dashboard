const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const payload = {
    spool_name: "Test Spool",
    brand: "Test",
    hex_color: "#C9A84C",
    spool_count: 1
  };
  const { data, error } = await supabase.from('inventory').insert(payload).select().single();
  if (error) {
    console.error("Insert Error:", error);
  } else {
    console.log("Inserted:", data);
  }
}
test();
