-- ============================================================
-- REPARACIÓN SISTEMA TELEGRAM — Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Añadir columnas faltantes a telegram_mensajes
ALTER TABLE public.telegram_mensajes
  ADD COLUMN IF NOT EXISTS etiqueta    text,
  ADD COLUMN IF NOT EXISTS nombre      text,        -- nombre/asunto del mensaje
  ADD COLUMN IF NOT EXISTS mensaje_final text;       -- texto final resuelto con variables

-- 2. Si existe columna 'contenido' pero vacía y mensaje_final tiene datos, migrar
UPDATE public.telegram_mensajes
  SET contenido = COALESCE(mensaje_final, contenido)
  WHERE contenido IS NULL AND mensaje_final IS NOT NULL;

-- 3. Reactivar políticas RLS para todas las tablas Telegram
DO $$
DECLARE
  tablas text[] := ARRAY[
    'telegram_usuarios','telegram_mensajes',
    'telegram_plantillas','programaciones','whatsapp_mensajes'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "allow_all" ON public.%I;
       CREATE POLICY "allow_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END $$;

-- 4. Índices adicionales para rendimiento
CREATE INDEX IF NOT EXISTS idx_telegram_mensajes_estado    ON public.telegram_mensajes(estado);
CREATE INDEX IF NOT EXISTS idx_telegram_mensajes_enviado   ON public.telegram_mensajes(enviado_por);
CREATE INDEX IF NOT EXISTS idx_telegram_plantillas_activo  ON public.telegram_plantillas(activo);
CREATE INDEX IF NOT EXISTS idx_telegram_plantillas_tipo    ON public.telegram_plantillas(tipo, categoria);
CREATE INDEX IF NOT EXISTS idx_telegram_usuarios_tipo      ON public.telegram_usuarios(tipo, activo);
CREATE INDEX IF NOT EXISTS idx_telegram_usuarios_empleado  ON public.telegram_usuarios(empleado_id);
CREATE INDEX IF NOT EXISTS idx_telegram_usuarios_flota     ON public.telegram_usuarios(flota_id);

-- 5. Añadir sucursal a telegram_mensajes (para futuro filtrado por sucursal)
ALTER TABLE public.telegram_mensajes
  ADD COLUMN IF NOT EXISTS sucursal_codigo char(2) REFERENCES public.sucursales(codigo);

-- 6. Verificación final
SELECT 'Reparacion telegram completada.' AS resultado;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'telegram_mensajes'
ORDER BY ordinal_position;
