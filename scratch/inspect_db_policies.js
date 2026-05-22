const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspectPolicies() {
  console.log("=== Active RLS Policies Sweep ===");
  
  // We can query pg_catalog to inspect policies if we have permission, or check metadata
  const { data, error } = await supabase.rpc('get_policies'); // If custom RPC exists
  if (error) {
    console.log("Custom RPC 'get_policies' not found. Fetching via raw SQL execution or testing tables...");
    
    // We can also query using the PostgREST interface to check which operations fail on which tables
    const tables = [
      "profiles",
      "settings",
      "creatures",
      "inventory",
      "orders",
      "finance",
      "printers",
      "site_settings",
      "reviews",
      "contact_submissions",
      "subscribers",
      "mileage",
      "email_templates"
    ];
    
    console.log("\nProbing standard operations for anonymous client:");
    for (const table of tables) {
      const { error: readErr } = await supabase.from(table).select("*").limit(1);
      const readStatus = readErr ? `❌ Read ERROR: ${readErr.message}` : "✅ Read OK";
      
      console.log(`- Table '${table}': ${readStatus}`);
    }
  } else {
    console.log("Active policies in public schema:", data);
  }
}

inspectPolicies();
