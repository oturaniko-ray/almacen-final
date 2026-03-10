export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authApi';
import { render } from '@react-email/components';
import { createClient } from '@supabase/supabase-js';
import { generarTokenUnico } from '@/lib/telegram/generate-link';

// Importaciones dinámicas
let nodemailer: any;
let BienvenidaEmpleado: any;
let BienvenidaFlota: any;

// Cliente Supabase Admin
function getSupabaseAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no configurada');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  
  return createClient(url, key);
}

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'Notificaacceso_bot';

// ================================================================
// TOKEN PARA EMPLEADO
// ================================================================
async function obtenerTokenEmpleado(
  supabase: any,
  empleadoId: string,
  documentoId: string
): Promise<string> {
  try {
    const { data: emp } = await supabase
      .from('empleados')
      .select('telegram_token')
      .eq('id', empleadoId)
      .maybeSingle();

    if (emp?.telegram_token) {
      console.log(`📱 Reutilizando token para empleado ${empleadoId}`);
      return emp.telegram_token;
    }

    const token = generarTokenUnico('emp', documentoId);
    console.log(`🔵 Generando nuevo token para empleado ${empleadoId}: ${token}`);

    await supabase
      .from('empleados')
      .update({ telegram_token: token, updated_at: new Date().toISOString() })
      .eq('id', empleadoId);

    return token;
  } catch (error) {
    console.error('Error en empleado:', error);
    return generarTokenUnico('emp', documentoId);
  }
}

// ================================================================
// TOKEN PARA FLOTA
// ================================================================
async function obtenerTokenFlota(
  supabase: any,
  flotaId: string,
  documentoId: string
): Promise<string> {
  try {
    const { data: flota } = await supabase
      .from('flota_perfil')
      .select('telegram_token')
      .eq('id', flotaId)
      .maybeSingle();

    if (flota?.telegram_token) {
      console.log(`📱 Reutilizando token para flota ${flotaId}`);
      return flota.telegram_token;
    }

    const token = generarTokenUnico('flt', documentoId);
    console.log(`🔵 Generando nuevo token para flota ${flotaId}: ${token}`);

    await supabase
      .from('flota_perfil')
      .update({ telegram_token: token, updated_at: new Date().toISOString() })
      .eq('id', flotaId);

    return token;
  } catch (error) {
    console.error('Error en flota:', error);
    return generarTokenUnico('flt', documentoId);
  }
}

// ================================================================
// HANDLER PRINCIPAL
// ================================================================
export async function POST(request: Request) {
  try {
    await requireAdminAuth();

    // ✅ Importaciones dinámicas
    nodemailer = await import('nodemailer');
    const emailComponents = await import('@/emails/BienvenidaEmpleado');
    const flotaComponents = await import('@/emails/BienvenidaFlota');
    
    BienvenidaEmpleado = emailComponents.default;
    BienvenidaFlota = flotaComponents.default;

    const body = await request.json();
    const { tipo, datos, to } = body;

    if (!tipo || !datos) {
      return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 });
    }

    const destinatario = to || datos.email;
    if (!destinatario) {
      return NextResponse.json({ success: false, error: 'Sin destinatario' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    
    // ✅ Transporter creado con el nodemailer importado
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ionos.es',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    let subject = '';
    let html = '';

    if (tipo === 'empleado') {
      subject = `Acceso al Sistema - Credenciales para ${datos.nombre}`;
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
      subject = `Perfil de Conductor Registrado - ${datos.nombre_completo}`;
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

    return NextResponse.json({ success: true, messageId: info.messageId });

  } catch (error: any) {
    console.error('Error en handler:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error desconocido' },
      { status: 500 }
    );
  }
}