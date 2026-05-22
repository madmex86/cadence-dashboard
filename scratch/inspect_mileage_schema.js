const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspectMileage() {
  console.log("=== mileage Columns Inspection ===");
  const possibleCols = [
    "id", "created_at", "updated_at",
    "trip_date", "date", "entry_date",
    "origin", "start_location",
    "destination", "end_location",
    "purpose", "description", "notes",
    "miles", "distance", "value",
    "user_id"
  ];
  
  const existing = [];
  for (const col of possibleCols) {
    const { error } = await supabase.from("mileage").select(col).limit(1);
    if (!error) {
      existing.push(col);
    }
  }
  console.log("Existing columns in 'mileage' table:", existing);
}

inspectMileage();
