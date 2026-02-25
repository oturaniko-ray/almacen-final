import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

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

    if (body.message) {
      await procesarMensaje(body.message).catch(err => {
        console.error('Error procesando mensaje de Telegram:', err);
      });
    }

    return NextResponse.json({ ok: true, message: "Webhook funcionando" });
  } catch (e) {
    console.error("No se pudo parsear el body Telegram:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function procesarMensaje(message: any) {
  const chatId = message.chat?.id;
  const texto = message.text?.trim() || '';

  if (!chatId || !texto) return;

  if (texto.startsWith('/start') || texto.startsWith('/vincular')) {
    const partes = texto.split(' ');
    const documentoId = partes[1];

    if (!documentoId) {
      await enviarMensajeTelegram(
        chatId,
        "🤖 *Bienvenido!*\nPara vincular tu cuenta con el sistema, por favor envía tu documento de identidad usando el comando:\n\n`/vincular TU_DOCUMENTO`"
      );
      return;
    }

    // Buscar el empleado
    const { data: empleado, error: empError } = await (supabase as any)
      .from('empleados')
      .select('id, nombre')
      .eq('documento_id', documentoId)
      .maybeSingle();

    if (empError || !empleado) {
      await enviarMensajeTelegram(chatId, "❌ No se encontró ningún empleado con ese documento de identidad.");
      return;
    }

    // Verificar si ya existe este chat_id
    const { data: existente } = await (supabase as any)
      .from('telegram_usuarios')
      .select('id')
      .eq('chat_id', String(chatId))
      .maybeSingle();

    if (existente) {
      // Actualizar empleado
      await (supabase as any)
        .from('telegram_usuarios')
        .update({ empleado_id: empleado.id })
        .eq('chat_id', String(chatId));
    } else {
      // Insertar nuevo
      await (supabase as any)
        .from('telegram_usuarios')
        .insert([{ chat_id: String(chatId), empleado_id: empleado.id }]);
    }

    await enviarMensajeTelegram(chatId, `✅ *Cuenta vinculada exitosamente.*\n¡Hola ${empleado.nombre}! Ahora recibirás tus notificaciones por aquí.`);
    return;
  }

  // Comandos genéricos o no reconocidos
  await enviarMensajeTelegram(chatId, "⚠️ Comando no reconocido.\nEnvía `/vincular TU_DOCUMENTO` para asociar tu cuenta.");
}

export async function GET() {
  return NextResponse.json({ message: "✅ Endpoint de prueba GET activo" });
}