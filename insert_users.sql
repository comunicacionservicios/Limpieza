-- Script para insertar los usuarios iniciales (Supervisores y Operarios)
-- Ejecutar en el SQL Editor de Supabase

INSERT INTO public.users (id, nombre, usuario, pin, rol, activo)
VALUES 
  ('abel', 'ABEL', 'ABEL', '1', 'supervisor', true),
  ('walter', 'WALTER', 'WALTER', '1211', 'supervisor', true),
  ('claudia', 'CLAUDIA', 'CLAUDIA', '1234', 'operario', true),
  ('angie', 'ANGIE', 'ANGIE', '1234', 'operario', true),
  ('florencia', 'FLORENCIA', 'FLORENCIA', '1234', 'operario', true),
  ('mario', 'MARIO', 'MARIO', '1234', 'operario', true),
  ('jose', 'JOSE', 'JOSE', '1234', 'operario', true),
  ('raul', 'RAUL', 'RAUL', '1234', 'operario', true),
  ('nicolas', 'NICOLAS', 'NICOLAS', '1234', 'operario', true)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  usuario = EXCLUDED.usuario,
  pin = EXCLUDED.pin,
  rol = EXCLUDED.rol,
  activo = EXCLUDED.activo;
