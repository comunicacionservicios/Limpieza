-- Tablas para la App de Limpieza

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY, -- Usamos el nombre de usuario en minúsculas como ID
    nombre TEXT NOT NULL,
    usuario TEXT NOT NULL UNIQUE,
    pin TEXT NOT NULL,
    rol TEXT DEFAULT 'operario',
    activo BOOLEAN DEFAULT true,
    whatsapp TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Tareas
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    frecuencia TEXT NOT NULL,
    tipo_limpieza TEXT, -- For compatibility with both naming conventions
    descripcion TEXT,
    fecha_vencimiento TEXT,
    last_completed_date TEXT,
    last_completed_by TEXT,
    asignados TEXT[], -- Array of names
    duracion_estimada_minutos INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Logs (Registros de actividad)
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operario_id TEXT REFERENCES public.users(id),
    operario_nombre TEXT,
    accion TEXT NOT NULL,
    inicio TIMESTAMP WITH TIME ZONE,
    fin TIMESTAMP WITH TIME ZONE,
    duracion INTEGER,
    detalles TEXT,
    fecha_argentina TEXT,
    estado TEXT DEFAULT 'Completado', -- Puede ser 'Pendiente', 'Aprobado', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Incidencias
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    autor TEXT,
    tipo TEXT,
    descripcion TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status TEXT DEFAULT 'Abierto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Comunicados (Anuncios)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Insumos (Stock)
CREATE TABLE IF NOT EXISTS public.insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    stock NUMERIC DEFAULT 0,
    unidad TEXT DEFAULT 'unidades',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Realtime para todas las tablas
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.insumos;
