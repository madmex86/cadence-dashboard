const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testSettings() {
  console.log("=== settings Table Inspection ===");
  
  // Try inserting a temp record
  const { data, error } = await supabase
    .from("settings")
    .upsert({ key: "test_key", value: "test_val" }, { onConflict: "key" })
    .select();
    
  if (error) {
    console.error("❌ settings upsert error:", error.message);
  } else {
    console.log("✅ settings upsert success! Saved row:", data);
    
    // Clean up
    const { error: delErr } = await supabase.from("settings").delete().eq("key", "test_key");
    if (delErr) {
      console.error("❌ settings delete error:", delErr.message);
    } else {
      console.log("✅ settings clean-up success!");
    }
  }
}

testSettings();
