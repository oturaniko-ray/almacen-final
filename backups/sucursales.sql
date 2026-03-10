-- ============================================================
-- EXPANSIÓN MULTI-SUCURSAL — Script de Migración
-- Sistema de Gestión de Accesos y Almacén
-- Ejecutar en Supabase → SQL Editor
-- Orden: ejecutar completo de una sola vez
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. TABLA: sucursales (catálogo de sedes)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sucursales (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                  char(2) UNIQUE NOT NULL,          -- '01' a '99'
  nombre                  text NOT NULL,
  provincia               text NOT NULL,
  lat                     numeric(11,7) NOT NULL DEFAULT 0,
  lon                     numeric(11,7) NOT NULL DEFAULT 0,
  radio_maximo            integer NOT NULL DEFAULT 100,     -- metros
  encargado               text,
  telefono                text,
  email                   text,
  activa                  boolean NOT NULL DEFAULT true,
  -- Config propia de cada sucursal (independiente de sistema_config global)
  timer_token             bigint NOT NULL DEFAULT 60000,
  timer_inactividad       bigint NOT NULL DEFAULT 300000,
  maximo_labor            bigint NOT NULL DEFAULT 28800000,
  porcentaje_efectividad  integer NOT NULL DEFAULT 70,
  empresa_nombre          text NOT NULL DEFAULT 'SUCURSAL',
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- Índices para detección GPS rápida
CREATE INDEX IF NOT EXISTS idx_sucursales_activa  ON public.sucursales(activa);
CREATE INDEX IF NOT EXISTS idx_sucursales_codigo  ON public.sucursales(codigo);
CREATE INDEX IF NOT EXISTS idx_sucursales_lat_lon ON public.sucursales(lat, lon);

-- Habilitar RLS
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all ON public.sucursales;
CREATE POLICY allow_all ON public.sucursales FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────
-- 2. INSERTAR SEDE PRINCIPAL (01)
--    Ajusta lat/lon/nombre según tu sede real
-- ──────────────────────────────────────────────────────────
INSERT INTO public.sucursales
  (codigo, nombre, provincia, lat, lon, radio_maximo, empresa_nombre)
VALUES
  ('01', 'Sede Principal', 'Madrid', 40.416775, -3.703790, 100, 'GESTION ACCESO')
ON CONFLICT (codigo) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 3. EXTENDER: correlativo → una fila por sucursal
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.correlativo
  ADD COLUMN IF NOT EXISTS sucursal_codigo char(2) REFERENCES public.sucursales(codigo) ON DELETE CASCADE;

-- Asignar sucursal '01' al correlativo existente
UPDATE public.correlativo SET sucursal_codigo = '01' WHERE sucursal_codigo IS NULL;

-- Crear registro de correlativo para la sede 01 si no existe
INSERT INTO public.correlativo (correlativo_personal, correlativo_flota, sucursal_codigo)
SELECT 0, 0, '01'
WHERE NOT EXISTS (
  SELECT 1 FROM public.correlativo WHERE sucursal_codigo = '01'
);

-- ──────────────────────────────────────────────────────────
-- 4. EXTENDER: empleados → sucursal de origen
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS sucursal_origen char(2) REFERENCES public.sucursales(codigo);

-- Los empleados existentes quedan asignados a sede 01
UPDATE public.empleados SET sucursal_origen = '01' WHERE sucursal_origen IS NULL;

-- ──────────────────────────────────────────────────────────
-- 5. EXTENDER: flota_perfil → sucursal de origen
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.flota_perfil
  ADD COLUMN IF NOT EXISTS sucursal_origen char(2) REFERENCES public.sucursales(codigo);

UPDATE public.flota_perfil SET sucursal_origen = '01' WHERE sucursal_origen IS NULL;

-- ──────────────────────────────────────────────────────────
-- 6. EXTENDER: jornadas → sucursal donde fichó el empleado
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.jornadas
  ADD COLUMN IF NOT EXISTS sucursal_codigo char(2) REFERENCES public.sucursales(codigo);

UPDATE public.jornadas SET sucursal_codigo = '01' WHERE sucursal_codigo IS NULL;

CREATE INDEX IF NOT EXISTS idx_jornadas_sucursal ON public.jornadas(sucursal_codigo);

-- ──────────────────────────────────────────────────────────
-- 7. EXTENDER: flota_accesos → sucursal donde entró
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.flota_accesos
  ADD COLUMN IF NOT EXISTS sucursal_codigo char(2) REFERENCES public.sucursales(codigo);

UPDATE public.flota_accesos SET sucursal_codigo = '01' WHERE sucursal_codigo IS NULL;

CREATE INDEX IF NOT EXISTS idx_flota_accesos_sucursal ON public.flota_accesos(sucursal_codigo);

-- ──────────────────────────────────────────────────────────
-- 8. FUNCIÓN ACTUALIZADA: generar_pin_empleado(sucursal_codigo)
--    Formato: E + NN + MMYY + 3 dígitos
--    Ejemplo: E010326001 (Empleado, Sucursal 01, Marzo 2026, #001)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generar_pin_empleado(p_sucursal char(2))
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_correlativo integer;
  v_mmyy text;
  v_pin text;
BEGIN
  -- Asegurar que existe registro de correlativo para esta sucursal
  INSERT INTO public.correlativo (correlativo_personal, correlativo_flota, sucursal_codigo)
  VALUES (0, 0, p_sucursal)
  ON CONFLICT DO NOTHING;

  UPDATE public.correlativo
  SET correlativo_personal = correlativo_personal + 1,
      updated_at = now()
  WHERE sucursal_codigo = p_sucursal
  RETURNING correlativo_personal INTO v_correlativo;

  v_mmyy := to_char(now(), 'MMYY');
  v_pin := 'E' || p_sucursal || v_mmyy || lpad(v_correlativo::text, 3, '0');
  RETURN v_pin;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 9. FUNCIÓN ACTUALIZADA: generar_pin_flota(sucursal_codigo)
--    Formato: F + NN + MMYY + 3 dígitos
--    Ejemplo: F010326001 (Flota, Sucursal 01, Marzo 2026, #001)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generar_pin_flota(p_sucursal char(2))
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_correlativo integer;
  v_mmyy text;
  v_pin text;
BEGIN
  INSERT INTO public.correlativo (correlativo_personal, correlativo_flota, sucursal_codigo)
  VALUES (0, 0, p_sucursal)
  ON CONFLICT DO NOTHING;

  UPDATE public.correlativo
  SET correlativo_flota = correlativo_flota + 1,
      updated_at = now()
  WHERE sucursal_codigo = p_sucursal
  RETURNING correlativo_flota INTO v_correlativo;

  v_mmyy := to_char(now(), 'MMYY');
  v_pin := 'F' || p_sucursal || v_mmyy || lpad(v_correlativo::text, 3, '0');
  RETURN v_pin;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 10. FUNCIÓN: detectar_sucursal(lat, lon)
--     Devuelve el codigo de la sucursal más cercana dentro de su radio
--     Retorna NULL si ninguna sucursal está en rango
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.detectar_sucursal(p_lat numeric, p_lon numeric)
RETURNS char(2) LANGUAGE plpgsql AS $$
DECLARE
  v_codigo  char(2);
  v_dist_m  numeric;
BEGIN
  SELECT
    codigo,
    -- Haversine simplificado: distancia en metros
    (6371000 * acos(
      LEAST(1.0, cos(radians(p_lat)) * cos(radians(lat))
        * cos(radians(lon) - radians(p_lon))
        + sin(radians(p_lat)) * sin(radians(lat))
    )) ) AS distancia
  INTO v_codigo, v_dist_m
  FROM public.sucursales
  WHERE activa = true
  ORDER BY distancia ASC
  LIMIT 1;

  -- Solo retorna si está dentro del radio de esa sucursal
  IF v_dist_m <= (SELECT radio_maximo FROM public.sucursales WHERE codigo = v_codigo) THEN
    RETURN v_codigo;
  END IF;

  RETURN NULL;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 11. VERIFICACIÓN FINAL
-- ──────────────────────────────────────────────────────────
-- Prueba de generación de PIN (debe devolver E010326001 o similar):
-- SELECT generar_pin_empleado('01');
-- SELECT generar_pin_flota('01');

-- Prueba de detección (usa coordenadas de Madrid como ejemplo):
-- SELECT detectar_sucursal(40.416775, -3.703790);

-- Ver la sucursal creada:
-- SELECT * FROM sucursales;
-- SELECT * FROM correlativo;

SELECT 'Migración multi-sucursal completada exitosamente.' AS resultado;
