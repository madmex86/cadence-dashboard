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
  // Check subscribers
  const { data: subs, error: err1 } = await supabase.from('subscribers').select('*').limit(3);
  if (err1) {
    console.error("Error fetching subscribers:", err1.message);
  } else {
    console.log("Subscribers row count:", subs?.length);
    console.log("Subscribers Keys:", Object.keys(subs[0] || {}));
    console.log("Sample Subscribers Details:", JSON.stringify(subs, null, 2));
  }

  // Check orders
  const { data: orders, error: err2 } = await supabase.from('orders').select('*');
  if (err2) {
    console.error("Error fetching orders:", err2.message);
  } else {
    console.log("Orders row count:", orders?.length);
  }
}
inspect();
