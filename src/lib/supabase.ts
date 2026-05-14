/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pdqsmajdyscwuiqkatpx.supabase.co';
const supabaseAnonKey = 'sb_publishable_9Ykw8IF4p0ziLA5om3J7xA_eNutjb9Q';

// Inicializamos el cliente solo si las variables existen para evitar errores críticos en el arranque
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : new Proxy({}, {
      get() {
        throw new Error('Supabase URL y Anon Key son requeridas. Por favor, configúralas en los secretos del proyecto (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).');
      }
    }) as any;
