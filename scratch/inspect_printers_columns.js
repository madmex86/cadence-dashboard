const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspectColumns() {
  console.log("=== Inspecting 'printers' Columns via RPC or query ===");
  // We can query custom SQL using an RPC if available, or fetch column details by executing a PostgREST query on table definition
  const { data, error } = await supabase.rpc('inspect_table_columns', { table_name: 'printers' });
  if (error) {
    console.log("RPC 'inspect_table_columns' not found, trying fallback select...");
    // Just fetch one row or empty row to see the fields returned
    const { data: row, error: selectError } = await supabase.from('printers').select('*').limit(1);
    if (selectError) {
      console.error("Select error:", selectError.message);
    } else {
      console.log("Returned columns in row:", row.length > 0 ? Object.keys(row[0]) : "No rows found to extract keys");
    }
  } else {
    console.log("Columns metadata:", data);
  }
}

inspectColumns();
