const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.storage.from("creature-images").upload("test.txt", "dummy content", { upsert: true });
  console.log("Upload Result:", error ? error.message : "Success: " + JSON.stringify(data));
}
test();
