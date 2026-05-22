const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse env variables from .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  const { data: subs, error: errSubs } = await supabase.from('subscribers').select('*').limit(5);
  if (errSubs) {
    console.error("Error fetching subscribers:", errSubs.message);
  } else {
    console.log("Subscribers Row Count / Sample Keys:", subs.length, subs[0] ? Object.keys(subs[0]) : "No data");
    console.log("Sample Subscribers Details:", JSON.stringify(subs, null, 2));
  }

  const { data: ords, error: errOrds } = await supabase.from('orders').select('*').limit(5);
  if (errOrds) {
    console.error("Error fetching orders:", errOrds.message);
  } else {
    console.log("Orders Row Count / Sample Keys:", ords.length, ords[0] ? Object.keys(ords[0]) : "No data");
    console.log("Sample Orders Details:", JSON.stringify(ords, null, 2));
  }
}
inspect();
