import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function enviarMensajeTelegram(chatId: string | number, text: string) {
  if (!TELEGRAM_TOKEN) return;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Detectar si el usuario bloqueó el bot
    if (body.my_chat_member?.new_chat_member?.status === 'kicked') {
      const chatId = body.my_chat_member.chat.id;
      await (supabase as any)
        .from('telegram_usuarios')
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq('chat_id', String(chatId));
      return NextResponse.json({ ok: true });
    }

    if (body.message) {
      await procesarMensaje(body.message).catch(err => {
        console.error('Error procesando mensaje de Telegram:', err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en webhook:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function procesarMensaje(message: any) {
  const chatId = message.chat?.id;
  const texto = message.text?.trim() || '';
  const from = message.from;

  if (!chatId || !texto || !from) return;

  // Datos del usuario de Telegram
  const nombre = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
  const username = from.username || null;
  const ahora = new Date().toISOString();

  // SOLO /start CON TOKEN
  if (texto.startsWith('/start')) {
    const partes = texto.split(' ');
    const token = partes[1];

    if (!token) {
      await enviarMensajeTelegram(
        chatId,
        "🤖 *Bienvenido al sistema de notificaciones!*\n\nPara comenzar, haz clic en el enlace que recibiste en tu correo de bienvenida."
      );
      return;
    }

    // ✅ BUSCAR PRIMERO EN EMPLEADOS (FUENTE DE VERDAD)
    const { data: empleado, error: empError } = await (supabase as any)
      .from('empleados')
      .select('id, nombre')
      .eq('telegram_token', token)
      .maybeSingle();

    if (!empError && empleado) {
      // Es un empleado
      const empleadoId = empleado.id;

      // Verificar si ya existe en telegram_usuarios
      const { data: existente } = await (supabase as any)
        .from('telegram_usuarios')
        .select('id')
        .eq('empleado_id', empleadoId)
        .maybeSingle();

      if (existente) {
        // Actualizar existente
        await (supabase as any)
          .from('telegram_usuarios')
          .update({
            chat_id: String(chatId),
            nombre,
            username,
            token_unico: token,
            activo: true,
            ultimo_mensaje: ahora,
            updated_at: ahora
          })
          .eq('empleado_id', empleadoId);
      } else {
        // Crear nuevo
        await (supabase as any)
          .from('telegram_usuarios')
          .insert({
            empleado_id: empleadoId,
            chat_id: String(chatId),
            nombre,
            username,
            token_unico: token,
            activo: true,
            ultimo_mensaje: ahora,
            created_at: ahora,
            updated_at: ahora
          });
      }

      await enviarMensajeTelegram(chatId, `✅ *¡Vinculación exitosa!*\n\nHola *${empleado.nombre}*,\nTu cuenta ha sido vinculada correctamente. A partir de ahora recibirás notificaciones del sistema por este canal.`);
      return;
    }

    // ✅ BUSCAR EN FLOTA
    const { data: flota, error: fltError } = await (supabase as any)
      .from('flota_perfil')
      .select('id, nombre_completo')
      .eq('telegram_token', token)
      .maybeSingle();

    if (!fltError && flota) {
      // Es flota
      const flotaId = flota.id;

      const { data: existente } = await (supabase as any)
        .from('telegram_usuarios')
        .select('id')
        .eq('flota_id', flotaId)
        .maybeSingle();

      if (existente) {
        await (supabase as any)
          .from('telegram_usuarios')
          .update({
            chat_id: String(chatId),
            nombre,
            username,
            token_unico: token,
            activo: true,
            ultimo_mensaje: ahora,
            updated_at: ahora
          })
          .eq('flota_id', flotaId);
      } else {
        await (supabase as any)
          .from('telegram_usuarios')
          .insert({
            flota_id: flotaId,
            chat_id: String(chatId),
            nombre,
            username,
            token_unico: token,
            activo: true,
            ultimo_mensaje: ahora,
            created_at: ahora,
            updated_at: ahora
          });
      }

      await enviarMensajeTelegram(chatId, `✅ *¡Vinculación exitosa!*\n\nHola *${flota.nombre_completo}*,\nTu perfil de flota ha sido vinculado correctamente. A partir de ahora recibirás notificaciones del sistema por este canal.`);
      return;
    }

    // Si llegamos aquí, el token no es válido
    await enviarMensajeTelegram(chatId, "❌ El enlace no es válido o ha expirado. Solicita un nuevo correo de bienvenida.");
    return;
  }

  // CUALQUIER OTRO MENSAJE (no /start)
  await enviarMensajeTelegram(
    chatId,
    "⚠️ Comando no reconocido.\n\nPara vincular tu cuenta, haz clic en el enlace que recibiste en tu correo de bienvenida."
  );
}

export async function GET() {
  return NextResponse.json({ message: "✅ Webhook de Telegram activo" });
}