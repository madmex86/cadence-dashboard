const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  console.log("=== Dumping all rows in 'printers' table (Service Client) ===");
  const { data, error } = await supabase.from('printers').select('*');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Printers rows:", JSON.stringify(data, null, 2));
  }
}

inspect();
