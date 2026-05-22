const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkPolicies() {
  console.log("=== Querying pg_policies (if exposed) ===");
  const { data, error } = await supabase.from("pg_policies").select("*");
  if (error) {
    console.log("❌ Could not read pg_policies directly via PostgREST:", error.message);
  } else {
    console.log("✅ Active database policies:", data);
  }
}

checkPolicies();
