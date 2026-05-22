const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectPolicies() {
  console.log("=== Inspecting policies on 'printers' table via RPC or standard view ===");
  // Let's run a query to get pg_policies info using direct PostgreSQL catalog
  // We can query pg_policies view using service role key if it's accessible
  const { data, error } = await supabase.from('pg_policies').select('*');
  if (error) {
    console.error("Direct select failed. Running fallback catalog query...");
    // Let's write a custom SQL query if we had an RPC, but we can also check if we can query pg_policies in pg_catalog
    const { data: data2, error: error2 } = await supabase.from('pg_catalog.pg_policies').select('*');
    if (error2) {
      console.error("Failed to query catalog directly:", error2.message);
    } else {
      console.log("Policies:", data2);
    }
  } else {
    console.log("Policies:", data);
  }
}

inspectPolicies();
