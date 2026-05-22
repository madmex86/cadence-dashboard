const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testInsert() {
  console.log("Trying to insert printer as anon client...");
  const payload = {
    name: "Anon Test Printer",
    type: "Bambu Lab A1 Mini",
    status: "idle"
  };
  const { data, error } = await supabase.from('printers').insert(payload).select();
  if (error) {
    console.error("Insert error:", error);
  } else {
    console.log("Insert success!", data);
  }
}

testInsert();
