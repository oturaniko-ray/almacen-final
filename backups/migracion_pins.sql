-- ============================================================
-- MIGRACIÓN DE PINs AL FORMATO MULTI-SUCURSAL
-- Ejecutar en Supabase → SQL Editor
-- ============================================================
-- ANTES: P0326001  (P + MMYY + 3-digit)  → longitud 8
-- DEPUÉS: E010326001 (E + SS + MMYY + 3-digit) → longitud 10
--
-- ANTES: F0326001  (F + MMYY + 3-digit)  → longitud 8
-- DESPUÉS: F010326001 (F + SS + MMYY + 3-digit) → longitud 10
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- PASO 1: VERIFICACIÓN PREVIA (sin cambios, solo lectura)
-- ──────────────────────────────────────────────────────────
SELECT 
  'EMPLEADOS - PINs por migrar' AS info,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE pin_seguridad LIKE 'P%' AND length(pin_seguridad) = 8) AS pines_viejos_P,
  COUNT(*) FILTER (WHERE pin_seguridad LIKE 'E%' AND length(pin_seguridad) = 10) AS pines_nuevos_E
FROM public.empleados;

SELECT 
  'FLOTA - PINs por migrar' AS info,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE pin_secreto LIKE 'F%' AND length(pin_secreto) = 8) AS pines_viejos_F,
  COUNT(*) FILTER (WHERE pin_secreto LIKE 'F%' AND length(pin_secreto) = 10) AS pines_nuevos_F
FROM public.flota_perfil;

-- ──────────────────────────────────────────────────────────
-- PASO 2: MIGRAR PINs DE EMPLEADOS
--   P0326001 → E + sucursal_origen (o '01') + 0326001
--   El substring(pin_seguridad, 2) quita el primer char (P)
-- ──────────────────────────────────────────────────────────
UPDATE public.empleados
SET 
  pin_seguridad = 'E' 
    || COALESCE(sucursal_origen, '01') 
    || substring(pin_seguridad FROM 2),
  updated_at = now()
WHERE 
  pin_seguridad LIKE 'P%'          -- Sólo PINs con prefijo P (formato viejo)
  AND length(pin_seguridad) = 8;   -- Longitud exacta del formato viejo

-- Resultado parcial
SELECT 
  id, nombre, documento_id, pin_seguridad, sucursal_origen
FROM public.empleados
WHERE pin_seguridad LIKE 'E%' AND length(pin_seguridad) = 10
ORDER BY updated_at DESC
LIMIT 20;

-- ──────────────────────────────────────────────────────────
-- PASO 3: MIGRAR PINs DE FLOTA
--   F0326001 → F + sucursal_origen (o '01') + 0326001
-- ──────────────────────────────────────────────────────────
UPDATE public.flota_perfil
SET 
  pin_secreto = 'F' 
    || COALESCE(sucursal_origen, '01') 
    || substring(pin_secreto FROM 2),
  updated_at = now()
WHERE 
  pin_secreto LIKE 'F%'           -- Sólo PINs con prefijo F (formato viejo de 8 chars)
  AND length(pin_secreto) = 8;    -- Longitud exacta del formato viejo

-- Resultado parcial
SELECT 
  id, nombre_completo, documento_id, pin_secreto, sucursal_origen
FROM public.flota_perfil
WHERE pin_secreto LIKE 'F%' AND length(pin_secreto) = 10
ORDER BY updated_at DESC
LIMIT 20;

-- ──────────────────────────────────────────────────────────
-- PASO 4: VERIFICACIÓN FINAL
-- ──────────────────────────────────────────────────────────
SELECT 
  'EMPLEADOS - Después de migración' AS info,
  COUNT(*) FILTER (WHERE pin_seguridad LIKE 'P%') AS pines_viejos_P_restantes,
  COUNT(*) FILTER (WHERE pin_seguridad LIKE 'E%') AS pines_nuevos_E,
  COUNT(*) FILTER (WHERE pin_seguridad NOT LIKE 'P%' AND pin_seguridad NOT LIKE 'E%') AS otros
FROM public.empleados;

SELECT 
  'FLOTA - Después de migración' AS info,
  COUNT(*) FILTER (WHERE length(pin_secreto) = 8) AS pines_viejos_8chars,
  COUNT(*) FILTER (WHERE length(pin_secreto) = 10) AS pines_nuevos_10chars
FROM public.flota_perfil;

-- ──────────────────────────────────────────────────────────
-- NOTA: El login en personal/login y flota/login acepta
-- ambos formatos durante la transición (código retrocompat
-- implementado en el frontend).
-- ──────────────────────────────────────────────────────────
