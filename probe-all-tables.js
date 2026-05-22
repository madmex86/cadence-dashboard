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
  "inventory",
  "creatures",
  "orders",
  "finance",
  "printers",
  "site_analytics",
  "messages",
  "contact_submissions",
  "reviews",
  "site_settings",
  "subscribers",
  "email_templates",
  "email_campaigns",
  "mileage",
  "profiles"
];

async function probe() {
  console.log("=== SUPABASE TABLE PROBE ===");
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${table}': ERROR - ${error.message}`);
    } else {
      if (data.length > 0) {
        console.log(`✅ Table '${table}': EXISTS (${data.length} row sample)`);
        console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
      } else {
        console.log(`✅ Table '${table}': EXISTS BUT EMPTY (0 rows)`);
        // If empty, let's probe common columns
        await probeEmptyTable(table);
      }
    }
  }
}

async function probeEmptyTable(table) {
  const columns = ['id', 'created_at', 'updated_at', 'name', 'email', 'title', 'content', 'value', 'amount', 'date', 'status'];
  const existing = [];
  for (const col of columns) {
    const { error } = await supabase.from(table).select(col).limit(1);
    if (!error) {
      existing.push(col);
    }
  }
  if (existing.length > 0) {
    console.log(`   Probed columns that exist: ${existing.join(', ')}`);
  } else {
    console.log(`   No standard columns matched.`);
  }
}

probe();
