import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://pdqsmajdyscwuiqkatpx.supabase.co', 'sb_publishable_9Ykw8IF4p0ziLA5om3J7xA_eNutjb9Q');
async function run() {
  const { data, error } = await supabase.from('announcements').delete().eq('id', '94785523-8b54-4b0f-803e-f312c762add7');
  console.log(data, error);
}
run();
