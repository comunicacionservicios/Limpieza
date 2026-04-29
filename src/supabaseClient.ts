import { createClient } from '@supabase/supabase-js';

// Usamos directamente las credenciales provistas por el usuario
const supabaseUrl = 'https://qfmmymcsexybpzmpyouk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbW15bWNzZXh5YnB6bXB5b3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDE3NDEsImV4cCI6MjA5Mjg3Nzc0MX0.4tAd7Hx-jZX2deWIYMd9VO0RaXfXDeHk1EDQ4DtU8K4';

export const supabase = createClient(supabaseUrl, supabaseKey);
