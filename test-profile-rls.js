const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log("Supabase Client initialized.");
  const id = 'de305d54-75b4-431b-adb2-eb6b9e546014'; // a valid uuid format
  console.log("Attempting test insert into 'profiles' table...");
  const { data, error } = await supabase.from('profiles').insert({
    id: id,
    email: 'test-user@cadencecreatures.com',
    full_name: 'Test Sync User',
    role: 'user'
  }).select();
  console.log("Insert result error:", error);
  console.log("Insert result data:", data);
}

test();
