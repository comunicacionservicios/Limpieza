/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Inicializamos el cliente solo si las variables existen para evitar errores críticos en el arranque
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : new Proxy({}, {
      get() {
        throw new Error('Supabase URL y Anon Key son requeridas. Por favor, configúralas en los secretos del proyecto (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).');
      }
    }) as any;
