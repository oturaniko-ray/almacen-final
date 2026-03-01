export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authApi';
import nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import { createClient } from '@supabase/supabase-js';
import BienvenidaEmpleado from '@/emails/BienvenidaEmpleado';
import BienvenidaFlota from '@/emails/BienvenidaFlota';
import { generarTokenUnico } from '@/lib/telegram/generate-link';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ionos.es',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

// Cliente Supabase con Service Role para bypass de RLS
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn('⚠️ BUILD: Supabase URL no configurada, usando placeholder.');
  }
  return createClient(url, key);
}

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'Notificaacceso_bot';

// ================================================================
// FUNCIÓN: Obtener o generar token para EMPLEADO
// ================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function obtenerTokenEmpleado(supabase: any, empleadoId: string, documentoId: string): Promise<string> {
  // 1. Buscar token existente
  const { data: emp } = await supabase
    .from('empleados')
    .select('telegram_token')
    .eq('id', empleadoId)
    .maybeSingle() as any;

  if (emp?.telegram_token) {
    console.log(`📱 Reutilizando token Telegram para empleado ${empleadoId}`);
    return emp.telegram_token as string;
  }

  // 2. Generar nuevo token
  const token = generarTokenUnico('emp', documentoId);
  console.log(`🔵 Generando nuevo token Telegram para empleado ${empleadoId}: ${token}`);

  // 3. Guardar en empleados
  const { error: updateError } = await (supabase as any)
    .from('empleados')
    .update({ telegram_token: token, updated_at: new Date().toISOString() })
    .eq('id', empleadoId);

  if (updateError) {
    console.error('🔴 Error guardando token en empleados:', updateError);
  } else {
    console.log('🟢 Token guardado en empleados.telegram_token OK');
  }

  // 4. Upsert inicial en telegram_usuarios (sin chat_id aún)
  const { error: upsertError } = await (supabase as any)
    .from('telegram_usuarios')
    .upsert({
      empleado_id: empleadoId,
      token_unico: token,
      tipo: 'empleado',
      activo: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'empleado_id' });

  if (upsertError) {
    console.error('🔴 Error en upsert telegram_usuarios (empleado):', upsertError);
  } else {
    console.log('🟢 Registro inicial en telegram_usuarios OK');
  }

  return token;
}

// ================================================================
// FUNCIÓN: Obtener o generar token para FLOTA
// ================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function obtenerTokenFlota(supabase: any, flotaId: string, documentoId: string): Promise<string> {
  // 1. Buscar token existente
  const { data: flota } = await supabase
    .from('flota_perfil')
    .select('telegram_token')
    .eq('id', flotaId)
    .maybeSingle() as any;

  if (flota?.telegram_token) {
    console.log(`📱 Reutilizando token Telegram para flota ${flotaId}`);
    return flota.telegram_token as string;
  }

  // 2. Generar nuevo token
  const token = generarTokenUnico('flt', documentoId);
  console.log(`🔵 Generando nuevo token Telegram para flota ${flotaId}: ${token}`);

  // 3. Guardar en flota_perfil
  const { error: updateError } = await (supabase as any)
    .from('flota_perfil')
    .update({ telegram_token: token, updated_at: new Date().toISOString() })
    .eq('id', flotaId);

  if (updateError) {
    console.error('🔴 Error guardando token en flota_perfil:', updateError);
  } else {
    console.log('🟢 Token guardado en flota_perfil.telegram_token OK');
  }

  // 4. Upsert inicial en telegram_usuarios (sin chat_id aún)
  const { error: upsertError } = await (supabase as any)
    .from('telegram_usuarios')
    .upsert({
      flota_id: flotaId,
      token_unico: token,
      tipo: 'flota',
      activo: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'flota_id' });

  if (upsertError) {
    console.error('🔴 Error en upsert telegram_usuarios (flota):', upsertError);
  } else {
    console.log('🟢 Registro inicial en telegram_usuarios OK');
  }

  return token;
}

// ================================================================
// HANDLER PRINCIPAL
// ================================================================
export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    const body = await request.json();
    const { tipo, datos, to } = body;

    if (!tipo || !datos) {
      return NextResponse.json({ success: false, error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const destinatario = to || datos.email;
    if (!destinatario) {
      return NextResponse.json({ success: false, error: 'No se especificó destinatario' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let subject = '';
    let html = '';

    if (tipo === 'empleado') {
      subject = `🎫 Bienvenido al Sistema - ${datos.nombre}`;

      // ✅ GENERAR / REUSAR TOKEN ANTES DEL RENDER
      const token = await obtenerTokenEmpleado(supabase, datos.empleadoId, datos.documento_id);
      const telegramLink = `https://t.me/${BOT_USERNAME}?start=${token}`;

      html = await render(BienvenidaEmpleado({
        nombre: datos.nombre,
        documento_id: datos.documento_id,
        email: datos.email,
        rol: datos.rol,
        nivel_acceso: datos.nivel_acceso,
        pin_seguridad: datos.pin_seguridad,
        telegramLink,
      }));

    } else if (tipo === 'flota') {
      subject = `🚛 Perfil de Flota Creado - ${datos.nombre_completo}`;

      // ✅ GENERAR / REUSAR TOKEN ANTES DEL RENDER
      const token = await obtenerTokenFlota(supabase, datos.flotaId, datos.documento_id);
      const telegramLink = `https://t.me/${BOT_USERNAME}?start=${token}`;

      html = await render(BienvenidaFlota({
        nombre_completo: datos.nombre_completo,
        documento_id: datos.documento_id,
        nombre_flota: datos.nombre_flota,
        cant_choferes: datos.cant_choferes,
        cant_rutas: datos.cant_rutas,
        pin_secreto: datos.pin_secreto,
        email: datos.email,
        telegramLink,
      }));
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'admin@redmundialenvios.online',
      to: destinatario,
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: `Email enviado correctamente a ${destinatario}`
    });

  } catch (error: any) {
    console.error('Error enviando email:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}