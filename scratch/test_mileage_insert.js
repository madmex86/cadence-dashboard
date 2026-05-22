const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testMileage() {
  console.log("=== mileage Table Write Test ===");
  const payload = {
    trip_date: new Date().toISOString().split('T')[0],
    origin: "Office",
    destination: "Post Office",
    purpose: "Ship creatures",
    miles: 4.5
  };
  const { data, error } = await supabase.from("mileage").insert(payload).select();
  if (error) {
    console.error("❌ mileage insert error:", error.message);
  } else {
    console.log("✅ mileage insert success! Row:", data);
    // Cleanup
    const { error: delErr } = await supabase.from("mileage").delete().eq("purpose", "Ship creatures");
    if (delErr) {
      console.error("❌ mileage cleanup error:", delErr.message);
    } else {
      console.log("✅ mileage cleanup success!");
    }
  }
}

testMileage();
