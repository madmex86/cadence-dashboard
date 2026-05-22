const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testColumn(colName, testValue) {
  const payload = { name: `Test ${colName}` };
  payload[colName] = testValue;
  const { error } = await supabase.from('printers').insert(payload);
  if (error && error.message.includes(`column "${colName}" of relation "printers" does not exist`)) {
    return false;
  }
  return true;
}

async function findColumns() {
  console.log("=== Finding Valid Columns of 'printers' table ===");
  const candidates = [
    { name: 'type', val: 'Bambu Lab P1S' },
    { name: 'model', val: 'Bambu Lab P1S' },
    { name: 'status', val: 'idle' },
    { name: 'current_job', val: 'None' },
    { name: 'current_creature_id', val: '00000000-0000-0000-0000-000000000000' },
    { name: 'ip_address', val: '192.168.1.1' },
    { name: 'active', val: true },
    { name: 'is_default', val: false },
    { name: 'notes', val: 'Test notes' }
  ];

  for (const c of candidates) {
    const exists = await testColumn(c.name, c.val);
    console.log(`- Column '${c.name}': ${exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
  }
}

findColumns();
