-- ============================================================
-- RECONSTRUCCIÓN COMPLETA DEL ESQUEMA DE BASE DE DATOS
-- Sistema de Gestión de Accesos y Almacén
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. TABLA: sistema_config
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sistema_config (
  clave         text PRIMARY KEY,
  valor         text,
  updated_at    timestamptz DEFAULT now()
);

INSERT INTO public.sistema_config (clave, valor) VALUES
  ('almacen_lat',            '0'),
  ('almacen_lon',            '0'),
  ('radio_maximo',           '100'),
  ('timer_token',            '60000'),
  ('timer_inactividad',      '300000'),
  ('empresa_nombre',         'SISTEMA'),
  ('maximo_labor',           '28800000'),
  ('porcentaje_efectividad', '70')
ON CONFLICT (clave) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 2. TABLA: correlativo (PINs secuenciales)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.correlativo (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlativo_personal  integer NOT NULL DEFAULT 0,
  correlativo_flota     integer NOT NULL DEFAULT 0,
  updated_at            timestamptz DEFAULT now()
);

INSERT INTO public.correlativo (correlativo_personal, correlativo_flota)
SELECT 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.correlativo);

-- ──────────────────────────────────────────────────────────
-- 3. FUNCIÓN: generar_pin_personal → P + MMAA + 3 dígitos
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generar_pin_personal()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_correlativo integer;
  v_mmaa text;
  v_pin text;
BEGIN
  UPDATE public.correlativo
  SET correlativo_personal = correlativo_personal + 1, updated_at = now()
  WHERE id = (SELECT id FROM public.correlativo LIMIT 1)
  RETURNING correlativo_personal INTO v_correlativo;
  v_mmaa := to_char(now(), 'MMYY');
  v_pin := 'P' || v_mmaa || lpad(v_correlativo::text, 3, '0');
  RETURN v_pin;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 4. FUNCIÓN: generar_pin_flota → F + MMAA + 3 dígitos
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generar_pin_flota()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_correlativo integer;
  v_mmaa text;
  v_pin text;
BEGIN
  UPDATE public.correlativo
  SET correlativo_flota = correlativo_flota + 1, updated_at = now()
  WHERE id = (SELECT id FROM public.correlativo LIMIT 1)
  RETURNING correlativo_flota INTO v_correlativo;
  v_mmaa := to_char(now(), 'MMYY');
  v_pin := 'F' || v_mmaa || lpad(v_correlativo::text, 3, '0');
  RETURN v_pin;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 5. TABLA: empleados
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.empleados (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                  text NOT NULL,
  documento_id            text UNIQUE NOT NULL,
  email                   text UNIQUE,
  telefono                text,
  rol                     text NOT NULL DEFAULT 'empleado',
  nivel_acceso            integer NOT NULL DEFAULT 1,
  pin_seguridad           text,
  pin_generado_en         timestamptz,
  activo                  boolean NOT NULL DEFAULT true,
  en_almacen              boolean NOT NULL DEFAULT false,
  permiso_reportes        boolean NOT NULL DEFAULT false,
  ultimo_ingreso          timestamptz,
  ultima_salida           timestamptz,
  telegram_token          text,
  telegram_chat_id        text,
  respondio_sincronizado  boolean NOT NULL DEFAULT false,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 6. TABLA: jornadas
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jornadas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id       uuid REFERENCES public.empleados(id) ON DELETE CASCADE,
  nombre_empleado   text,
  hora_entrada      timestamptz NOT NULL DEFAULT now(),
  hora_salida       timestamptz,
  horas_trabajadas  numeric(5,2),
  autoriza_entrada  text,
  autoriza_salida   text,
  estado            text NOT NULL DEFAULT 'activo',
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jornadas_empleado ON public.jornadas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_estado   ON public.jornadas(estado);

-- ──────────────────────────────────────────────────────────
-- 7. TABLA: flota_perfil
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flota_perfil (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo   text NOT NULL,
  documento_id      text UNIQUE NOT NULL,
  email             text,
  telefono          text,
  nombre_flota      text,
  cant_choferes     integer NOT NULL DEFAULT 0,
  cant_rutas        integer NOT NULL DEFAULT 0,
  pin_secreto       text,
  activo            boolean NOT NULL DEFAULT true,
  en_patio          boolean NOT NULL DEFAULT false,
  telegram_token    text,
  telegram_chat_id  text,
  fecha_creacion    timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 8. TABLA: flota_accesos
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flota_accesos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid REFERENCES public.flota_perfil(id) ON DELETE CASCADE,
  nombre_completo text,
  documento_id    text,
  cant_choferes   integer DEFAULT 0,
  cant_carga      integer DEFAULT 0,
  observacion     text,
  hora_llegada    timestamptz NOT NULL DEFAULT now(),
  hora_salida     timestamptz,
  estado          text NOT NULL DEFAULT 'en_patio',
  autorizado_por  text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flota_accesos_perfil ON public.flota_accesos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_flota_accesos_estado ON public.flota_accesos(estado);

-- ──────────────────────────────────────────────────────────
-- 9. TABLA: auditoria_flota (llenada por trigger)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auditoria_flota (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id        uuid REFERENCES public.flota_perfil(id) ON DELETE CASCADE,
  acceso_id        uuid REFERENCES public.flota_accesos(id) ON DELETE SET NULL,
  fecha_proceso    date NOT NULL DEFAULT CURRENT_DATE,
  horas_en_patio   numeric(6,2),
  horas_exceso     numeric(6,2),
  carga_real       integer,
  carga_esperada   integer,
  eficiencia_score numeric(5,2),
  created_at       timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 10. TRIGGER: procesar_auditoria_flota
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.procesar_auditoria_flota()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_maximo_ms      numeric;
  v_maximo_horas   numeric;
  v_horas_en_patio numeric;
  v_horas_exceso   numeric;
  v_carga_esperada integer;
  v_eficiencia     numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.hora_salida IS NOT NULL AND OLD.hora_salida IS NULL THEN
    SELECT cant_rutas INTO v_carga_esperada FROM flota_perfil WHERE id = NEW.perfil_id;
    v_carga_esperada := COALESCE(v_carga_esperada, 0);
    v_horas_en_patio := EXTRACT(EPOCH FROM (NEW.hora_salida - NEW.hora_llegada)) / 3600;
    BEGIN
      SELECT COALESCE(CAST(valor AS numeric), 28800000) INTO v_maximo_ms
      FROM public.sistema_config WHERE clave = 'maximo_labor' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_maximo_ms := 28800000; END;
    v_maximo_horas := COALESCE(v_maximo_ms, 28800000) / 3600000.0;
    v_horas_exceso := GREATEST(0, v_horas_en_patio - v_maximo_horas);
    IF v_carga_esperada > 0 THEN
      v_eficiencia := (NEW.cant_carga::numeric / v_carga_esperada) * 100;
    ELSE v_eficiencia := 0; END IF;
    INSERT INTO public.auditoria_flota (
      perfil_id, acceso_id, fecha_proceso, horas_en_patio, horas_exceso,
      carga_real, carga_esperada, eficiencia_score, created_at
    ) VALUES (
      NEW.perfil_id, NEW.id, CURRENT_DATE, v_horas_en_patio, v_horas_exceso,
      NEW.cant_carga, v_carga_esperada, v_eficiencia, NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_flota ON public.flota_accesos;
CREATE TRIGGER trg_auditoria_flota
  AFTER UPDATE ON public.flota_accesos
  FOR EACH ROW EXECUTE FUNCTION public.procesar_auditoria_flota();

-- ──────────────────────────────────────────────────────────
-- 11. TABLA: telegram_usuarios
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telegram_usuarios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id        text UNIQUE NOT NULL,
  empleado_id    uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  flota_id       uuid REFERENCES public.flota_perfil(id) ON DELETE SET NULL,
  nombre         text,
  username       text,
  tipo           text NOT NULL DEFAULT 'empleado',
  activo         boolean NOT NULL DEFAULT true,
  ultimo_mensaje timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 12. TABLA: telegram_mensajes
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telegram_mensajes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enviado_por       uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  tipo_destinatario text NOT NULL,
  destinatario_id   uuid,
  contenido         text NOT NULL,
  enviados          integer DEFAULT 0,
  errores           integer DEFAULT 0,
  estado            text NOT NULL DEFAULT 'enviado',
  plantilla_id      uuid,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_mensajes_tipo ON public.telegram_mensajes(tipo_destinatario);
CREATE INDEX IF NOT EXISTS idx_telegram_mensajes_date ON public.telegram_mensajes(created_at);

-- ──────────────────────────────────────────────────────────
-- 13. TABLA: telegram_plantillas
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telegram_plantillas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  contenido   text NOT NULL,
  categoria   text NOT NULL DEFAULT 'otro',
  tipo        text NOT NULL DEFAULT 'ambos',
  variables   text[] DEFAULT '{}',
  activo      boolean NOT NULL DEFAULT true,
  creado_por  uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 14. TABLA: programaciones
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.programaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  tipo          text NOT NULL,
  destinatarios jsonb NOT NULL DEFAULT '[]',
  contenido     text NOT NULL,
  fecha_envio   timestamptz NOT NULL,
  estado        text NOT NULL DEFAULT 'pendiente',
  plantilla_id  uuid,
  creado_por    uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  resultado     jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_programaciones_estado ON public.programaciones(estado);
CREATE INDEX IF NOT EXISTS idx_programaciones_fecha  ON public.programaciones(fecha_envio);

-- ──────────────────────────────────────────────────────────
-- 15. TABLA: whatsapp_mensajes
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_mensajes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono    text NOT NULL,
  contenido   text NOT NULL,
  direccion   text NOT NULL DEFAULT 'entrante',
  estado      text,
  mensaje_id  text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_telefono ON public.whatsapp_mensajes(telefono);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_date     ON public.whatsapp_mensajes(created_at);

-- ──────────────────────────────────────────────────────────
-- 16. ROW LEVEL SECURITY — política permisiva (todas las tablas)
-- ──────────────────────────────────────────────────────────
DO $$
DECLARE
  tablas text[] := ARRAY[
    'empleados','jornadas','flota_perfil','flota_accesos',
    'auditoria_flota','telegram_usuarios','telegram_mensajes',
    'telegram_plantillas','programaciones','whatsapp_mensajes',
    'sistema_config','correlativo'
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

-- ============================================================
-- FIN. Verifica en Table Editor que aparezcan las 12 tablas
-- y en Database → Functions las 3 funciones/trigger.
-- ============================================================
