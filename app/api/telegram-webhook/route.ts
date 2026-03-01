import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Dar tiempo suficiente al handler en Vercel

// ================================================================
// HELPERS
// ================================================================
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL no configurados');
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chat_id: number | string, text: string, reply_markup?: object) {
  const body: Record<string, unknown> = { chat_id, text, parse_mode: 'HTML' };
  if (reply_markup) body.reply_markup = reply_markup;
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) console.error('sendMessage error:', JSON.stringify(data));
  return data;
}

async function answerCallbackQuery(callback_query_id: string, text: string, show_alert = false) {
  await fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id, text, show_alert }),
  });
}

async function editMessageReplyMarkup(chat_id: number | string, message_id: number) {
  await fetch(`${API}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, message_id, reply_markup: { inline_keyboard: [] } }),
  });
}

// ================================================================
// HANDLER: /start TOKEN
// ================================================================
async function handleStart(chatId: number, token: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    await sendMessage(chatId, '❌ Error de configuración del servidor. Contacta al administrador.');
    return;
  }

  console.log(`🔍 Buscando token: ${token}`);

  // Buscar en empleados
  const { data: empleado, error: empError } = await supabase
    .from('empleados')
    .select('id, nombre, telegram_token')
    .eq('telegram_token', token)
    .maybeSingle() as any;

  if (empError) console.error('Error buscando empleado:', empError);

  if (empleado) {
    console.log(`✅ Empleado encontrado: ${empleado.nombre}`);
    await sendMessage(chatId,
      `👋 Hola <b>${empleado.nombre}</b>!\n\nPulsa el botón para vincular tu cuenta de Telegram al sistema y activar las notificaciones.`,
      {
        inline_keyboard: [[{
          text: '✅ Confirmar y vincular Telegram',
          callback_data: `confirm_emp_${token}`
        }]]
      }
    );
    return;
  }

  // Buscar en flota_perfil
  const { data: flota, error: fltError } = await supabase
    .from('flota_perfil')
    .select('id, nombre_completo, telegram_token')
    .eq('telegram_token', token)
    .maybeSingle() as any;

  if (fltError) console.error('Error buscando flota:', fltError);

  if (flota) {
    console.log(`✅ Flota encontrada: ${flota.nombre_completo}`);
    await sendMessage(chatId,
      `👋 Hola <b>${flota.nombre_completo}</b>!\n\nPulsa el botón para vincular tu cuenta de Telegram al sistema y activar las notificaciones.`,
      {
        inline_keyboard: [[{
          text: '✅ Confirmar y vincular Telegram',
          callback_data: `confirm_flt_${token}`
        }]]
      }
    );
    return;
  }

  console.warn(`⚠️ Token no encontrado: ${token}`);
  await sendMessage(chatId, '❌ El enlace no es válido o ha expirado. Solicita que te reenvíen el correo de bienvenida.');
}

// ================================================================
// HANDLER: Confirmación de empleado
// ================================================================
async function handleConfirmEmpleado(
  callbackQueryId: string,
  chatId: number,
  messageId: number,
  username: string | undefined,
  token: string
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    await answerCallbackQuery(callbackQueryId, '❌ Error del servidor', true);
    return;
  }

  const { data: empleado, error } = await supabase
    .from('empleados')
    .select('id, nombre')
    .eq('telegram_token', token)
    .single() as any;

  if (error || !empleado) {
    console.error('Token empleado no encontrado:', error);
    await answerCallbackQuery(callbackQueryId, 'Token inválido o expirado', true);
    return;
  }

  const ahora = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from('telegram_usuarios')
    .upsert({
      empleado_id: empleado.id,
      chat_id: String(chatId),
      nombre: empleado.nombre,
      username: username || null,
      tipo: 'empleado',
      activo: true,
      ultimo_mensaje: ahora,
      updated_at: ahora,
    }, { onConflict: 'chat_id' }) as any;

  if (upsertError) {
    console.error('❌ Error insertando telegram_usuarios (empleado):', JSON.stringify(upsertError));
    await answerCallbackQuery(callbackQueryId, 'Error al vincular. Intenta de nuevo.', true);
    return;
  }

  console.log(`🟢 Empleado ${empleado.nombre} vinculado con chat_id ${chatId}`);
  await answerCallbackQuery(callbackQueryId, '¡Vinculación exitosa! 🎉');
  await editMessageReplyMarkup(chatId, messageId);
  await sendMessage(chatId,
    `✅ ¡Perfecto, <b>${empleado.nombre}</b>!\n\nTu Telegram ha sido vinculado correctamente. Recibirás notificaciones sobre:\n• 📅 Horarios de entrada/salida\n• 🏖️ Días de descanso\n• 📢 Avisos importantes del almacén`
  );
}

// ================================================================
// HANDLER: Confirmación de flota
// ================================================================
async function handleConfirmFlota(
  callbackQueryId: string,
  chatId: number,
  messageId: number,
  username: string | undefined,
  token: string
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    await answerCallbackQuery(callbackQueryId, '❌ Error del servidor', true);
    return;
  }

  const { data: flota, error } = await supabase
    .from('flota_perfil')
    .select('id, nombre_completo')
    .eq('telegram_token', token)
    .single() as any;

  if (error || !flota) {
    console.error('Token flota no encontrado:', error);
    await answerCallbackQuery(callbackQueryId, 'Token inválido o expirado', true);
    return;
  }

  const ahora = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from('telegram_usuarios')
    .upsert({
      flota_id: flota.id,
      chat_id: String(chatId),
      nombre: flota.nombre_completo,
      username: username || null,
      tipo: 'flota',
      activo: true,
      ultimo_mensaje: ahora,
      updated_at: ahora,
    }, { onConflict: 'chat_id' }) as any;

  if (upsertError) {
    console.error('❌ Error insertando telegram_usuarios (flota):', JSON.stringify(upsertError));
    await answerCallbackQuery(callbackQueryId, 'Error al vincular. Intenta de nuevo.', true);
    return;
  }

  console.log(`🟢 Flota ${flota.nombre_completo} vinculada con chat_id ${chatId}`);
  await answerCallbackQuery(callbackQueryId, '¡Vinculación exitosa! 🎉');
  await editMessageReplyMarkup(chatId, messageId);
  await sendMessage(chatId,
    `✅ ¡Perfecto, <b>${flota.nombre_completo}</b>!\n\nTu Telegram ha sido vinculado al sistema de flota. Recibirás notificaciones sobre:\n• 🚛 Cambios en tus rutas\n• ⏰ Horarios de carga/descarga\n• 📢 Avisos importantes`
  );
}

// ================================================================
// POST: Entrada del webhook
// ================================================================
export async function POST(request: NextRequest) {
  let update: any;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('📬 Telegram update recibido:', JSON.stringify(update).substring(0, 500));

  try {
    // ── Mensaje de texto (/start TOKEN) ──
    if (update.message?.text) {
      const text: string = update.message.text;
      const chatId: number = update.message.chat.id;

      if (text.startsWith('/start ')) {
        const token = text.slice(7).trim(); // todo lo que sigue a "/start "
        await handleStart(chatId, token);
      } else if (text === '/start') {
        await sendMessage(chatId, '🤖 Usa el enlace personalizado del correo de bienvenida para vincular tu cuenta.');
      }
    }

    // ── Callback query (botón de confirmar) ──
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId: number = cq.message?.chat?.id;
      const messageId: number = cq.message?.message_id;
      const callbackQueryId: string = cq.id;
      const username: string | undefined = cq.from?.username;
      const data: string = cq.data || '';

      if (data.startsWith('confirm_emp_')) {
        const token = data.replace('confirm_emp_', '');
        await handleConfirmEmpleado(callbackQueryId, chatId, messageId, username, token);
      } else if (data.startsWith('confirm_flt_')) {
        const token = data.replace('confirm_flt_', '');
        await handleConfirmFlota(callbackQueryId, chatId, messageId, username, token);
      }
    }
  } catch (error: any) {
    console.error('❌ Error procesando update de Telegram:', error?.message || error);
  }

  // Telegram requiere siempre un 200 OK rápido
  return NextResponse.json({ ok: true });
}