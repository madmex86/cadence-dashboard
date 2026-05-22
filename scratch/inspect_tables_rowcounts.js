const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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

async function inspectRowCounts() {
  console.log("=== Database Table Row Counts Sweep ===");
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select("*", { count: 'exact', head: true });
    if (error) {
      console.log(`- Table '${table}': ❌ Error - ${error.message}`);
    } else {
      console.log(`- Table '${table}': ✅ OK - ${count} rows`);
    }
  }
}

inspectRowCounts();
