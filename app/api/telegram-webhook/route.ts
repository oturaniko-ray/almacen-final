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

  // Actualizar último mensaje SIEMPRE (para cualquier mensaje)
  await (supabase as any)
    .from('telegram_usuarios')
    .update({ 
      ultimo_mensaje: ahora,
      updated_at: ahora,
      nombre,
      username
    })
    .eq('chat_id', String(chatId));

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

    // Buscar el token en la tabla
    const { data: tokenRecord, error } = await (supabase as any)
      .from('telegram_usuarios')
      .select('empleado_id, flota_id, token_unico')
      .eq('token_unico', token)
      .maybeSingle();

    if (error || !tokenRecord) {
      await enviarMensajeTelegram(chatId, "❌ El enlace no es válido o ha expirado. Solicita un nuevo correo de bienvenida.");
      return;
    }

    if (tokenRecord.empleado_id) {
      // Es un empleado
      const { data: empleado } = await (supabase as any)
        .from('empleados')
        .select('nombre')
        .eq('id', tokenRecord.empleado_id)
        .single();

      // ✅ CORREGIDO: Añadido token_unico al update
      await (supabase as any)
        .from('telegram_usuarios')
        .update({
          chat_id: String(chatId),
          nombre,
          username,
          token_unico: token,  // ← AÑADIDO
          activo: true,
          ultimo_mensaje: ahora,
          updated_at: ahora
        })
        .eq('token_unico', token);

      await enviarMensajeTelegram(chatId, `✅ *¡Vinculación exitosa!*\n\nHola *${empleado.nombre}*,\nTu cuenta ha sido vinculada correctamente. A partir de ahora recibirás notificaciones del sistema por este canal.`);

    } else if (tokenRecord.flota_id) {
      // Es flota
      const { data: flota } = await (supabase as any)
        .from('flota_perfil')
        .select('nombre_completo')
        .eq('id', tokenRecord.flota_id)
        .single();

      // ✅ CORREGIDO: Añadido token_unico al update
      await (supabase as any)
        .from('telegram_usuarios')
        .update({
          chat_id: String(chatId),
          nombre,
          username,
          token_unico: token,  // ← AÑADIDO
          activo: true,
          ultimo_mensaje: ahora,
          updated_at: ahora
        })
        .eq('token_unico', token);

      await enviarMensajeTelegram(chatId, `✅ *¡Vinculación exitosa!*\n\nHola *${flota.nombre_completo}*,\nTu perfil de flota ha sido vinculado correctamente. A partir de ahora recibirás notificaciones del sistema por este canal.`);
    }

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