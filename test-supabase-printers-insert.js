const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const payload = { name: "Test Printer", type: "Test Model", status: "idle" };
  const { error } = await supabase.from('printers').insert(payload);
  console.log('Error with status:', error);
  
  if (error && error.message.includes('Could not find')) {
    const payload2 = { name: "Test Printer", type: "Test Model" };
    const { error: error2 } = await supabase.from('printers').insert(payload2);
    console.log('Error without status:', error2);
  }
}
test();
