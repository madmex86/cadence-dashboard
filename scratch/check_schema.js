
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ufqiysdgmxrhonnfsgts.supabase.co', 'sb_publishable_7mkBL1lsKUNJEmqSd2HT9Q_Z4xHoBec');

async function checkCC() {
  const { data, error } = await supabase.from('cc_customers').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('cc_customers keys:', Object.keys(data[0] || {}));
  }
}

checkCC();
