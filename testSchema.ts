import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://qfmmymcsexybpzmpyouk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbW15bWNzZXh5YnB6bXB5b3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDE3NDEsImV4cCI6MjA5Mjg3Nzc0MX0.4tAd7Hx-jZX2deWIYMd9VO0RaXfXDeHk1EDQ4DtU8K4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { error: e1 } = await supabase.from('Limpieza_Personal').select('rol').limit(1);
  const { error: e2 } = await supabase.from('Limpieza_Tareas_Plan').select('fecha_vencimiento').limit(1);
  console.log('Error rol:', e1?.message || 'Exito');
  console.log('Error fecha:', e2?.message || 'Exito');
}
test();
