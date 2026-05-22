const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log("=== Testing Insert on printers Table ===");
  const payload = { name: "Test Printer A", type: "Bambu Lab A1 Mini", status: "idle" };
  const { data, error } = await supabase.from('printers').insert(payload).select();
  if (error) {
    console.error("❌ Insert failed:", error.message);
    console.error("Full error detail:", error);
  } else {
    console.log("✅ Insert successful! Inserted row:", data);
  }
}

test();
