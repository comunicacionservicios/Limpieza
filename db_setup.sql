-- ========================================================
-- SCRIPT DE INICIALIZACIÓN DE LA BASE DE DATOS (SUPABASE)
-- Ejecutar todo esto en el panel de "SQL Editor" en Supabase
-- ========================================================

-- Eliminar tablas si existen (CUIDADO: Esto borra los datos si la tabla ya existía, comentar si es solo para agregar tablas nuevas)
-- DROP TABLE IF EXISTS public.logs;
-- DROP TABLE IF EXISTS public.tasks;
-- DROP TABLE IF EXISTS public.incidents;
-- DROP TABLE IF EXISTS public.announcements;
-- DROP TABLE IF EXISTS public.insumos;
-- DROP TABLE IF EXISTS public.users;

-- 1. Crear tabla de Usuarios (users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL,
  pin TEXT NOT NULL,
  rol TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  whatsapp TEXT,
  email TEXT,
  horario_entrada TEXT, -- HH:mm
  horario_salida TEXT,  -- HH:mm
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear tabla de Registros Operativos / Sesiones (logs)
CREATE TABLE IF NOT EXISTS public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id TEXT,
  operario_nombre TEXT,
  accion TEXT NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  duracion_minutos INTEGER DEFAULT 0,
  detalles TEXT,
  estado TEXT,
  fecha_argentina TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para logs (Optimización de rendimiento)
CREATE INDEX IF NOT EXISTS idx_logs_operario_id ON public.logs(operario_id);
CREATE INDEX IF NOT EXISTS idx_logs_inicio ON public.logs(inicio);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_operario_nombre ON public.logs(operario_nombre);

-- 3. Crear tabla de Tareas Planificadas (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  dia TEXT,
  inicio TEXT,
  fin TEXT,
  color TEXT,
  area TEXT,
  recurrence TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at);

-- 4. Crear tabla de Incidencias (incidents)
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id TEXT,
  operario_nombre TEXT,
  area TEXT,
  severidad TEXT,
  descripcion TEXT,
  foto_url TEXT,
  estado TEXT DEFAULT 'Pendiente',
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_estado ON public.incidents(estado);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at);

-- 5. Crear tabla de Anuncios (announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  fecha TEXT,
  prioridad TEXT DEFAULT 'normal',
  leido_por JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice GIN para buscar rápidamente en JSONB leido_por
CREATE INDEX IF NOT EXISTS idx_announcements_leido_por ON public.announcements USING GIN (leido_por);

-- 6. Crear tabla de Insumos (insumos)
CREATE TABLE IF NOT EXISTS public.insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  unidad TEXT,
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- Políticas de Seguridad (RLS - Row Level Security) 
-- Para simplificar la demo, habilitamos acceso anónimo/público a las tablas
-- Si necesitas seguridad real, quita estas reglas y configura políticas propias
-- =========================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All on users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow All on logs" ON public.logs FOR ALL USING (true);
CREATE POLICY "Allow All on tasks" ON public.tasks FOR ALL USING (true);
CREATE POLICY "Allow All on incidents" ON public.incidents FOR ALL USING (true);
CREATE POLICY "Allow All on announcements" ON public.announcements FOR ALL USING (true);
CREATE POLICY "Allow All on insumos" ON public.insumos FOR ALL USING (true);

-- ========================================================
-- INSERTAR USUARIOS DE EJEMPLO
-- ========================================================
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
