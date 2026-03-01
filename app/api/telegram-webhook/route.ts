import { NextRequest, NextResponse } from 'next/server';
import { Bot, InlineKeyboard } from 'grammy';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn('⚠️ BUILD: Supabase URL no configurada, usando placeholder.');
  }
  return createClient(url, key);
}

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || 'placeholder');

// ================================================================
// HANDLER: /start [token]
// El chat_id y username vienen del propio mensaje de Telegram.
// El nombre se obtiene de la tabla empleados/flota_perfil.
// ================================================================
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  if (!text?.startsWith('/start')) return;

  const token = text.split(' ')[1];
  if (!token) {
    await ctx.reply('🤖 Usa el enlace personalizado que recibiste en tu correo de bienvenida para vincular tu cuenta.');
    return;
  }

  const supabase = getSupabaseAdmin();

  // 1. Buscar en empleados
  const { data: empleado } = await (supabase as any)
    .from('empleados')
    .select('id, nombre, telegram_token')
    .eq('telegram_token', token)
    .maybeSingle();

  if (empleado) {
    const keyboard = new InlineKeyboard().text(
      '✅ Confirmar y vincular Telegram',
      `confirm_emp_${token}`
    );
    await ctx.reply(
      `👋 Hola ${empleado.nombre}!\n\nPulsa el botón para vincular tu cuenta de Telegram al sistema y activar las notificaciones:`,
      { reply_markup: keyboard }
    );
    return;
  }

  // 2. Buscar en flota_perfil
  const { data: flota } = await (supabase as any)
    .from('flota_perfil')
    .select('id, nombre_completo, telegram_token')
    .eq('telegram_token', token)
    .maybeSingle();

  if (flota) {
    const keyboard = new InlineKeyboard().text(
      '✅ Confirmar y vincular Telegram',
      `confirm_flt_${token}`
    );
    await ctx.reply(
      `👋 Hola ${flota.nombre_completo}!\n\nPulsa el botón para vincular tu cuenta de Telegram al sistema y activar las notificaciones:`,
      { reply_markup: keyboard }
    );
    return;
  }

  await ctx.reply('❌ El enlace no es válido o ha expirado. Solicita que te reenvíen el correo de bienvenida.');
});

// ================================================================
// HANDLER: Confirmación por botón
// - chat_id y username: obtenidos automáticamente de Telegram
// - nombre: obtenido de la tabla empleados/flota_perfil
// - token_unico: NO se guarda (empleado_id/flota_id es suficiente para identificar al usuario)
// ================================================================
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const from = ctx.callbackQuery.from;
  const chatId = String(from.id);
  const username = from.username || null;

  const supabase = getSupabaseAdmin();
  const ahora = new Date().toISOString();

  // ── EMPLEADO ──
  if (data?.startsWith('confirm_emp_')) {
    const token = data.replace('confirm_emp_', '');

    // Obtener datos del empleado desde la BD (nombre ya está ahí)
    const { data: empleado, error } = await (supabase as any)
      .from('empleados')
      .select('id, nombre')
      .eq('telegram_token', token)
      .single();

    if (error || !empleado) {
      await ctx.answerCallbackQuery({ text: 'Token inválido o expirado', show_alert: true });
      return;
    }

    // Insertar o actualizar en telegram_usuarios usando chat_id como clave de conflicto
    const { error: upsertError } = await (supabase as any)
      .from('telegram_usuarios')
      .upsert({
        empleado_id: empleado.id,
        chat_id: chatId,
        nombre: empleado.nombre,   // nombre desde BD, no desde Telegram
        username,                   // username desde Telegram automáticamente
        tipo: 'empleado',
        activo: true,
        ultimo_mensaje: ahora,
        updated_at: ahora,
      }, { onConflict: 'chat_id' });

    if (upsertError) {
      console.error('Error upsert telegram_usuarios (empleado):', JSON.stringify(upsertError));
      await ctx.answerCallbackQuery({ text: 'Error interno, intenta de nuevo', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: '¡Vinculación exitosa! 🎉' });
    await ctx.editMessageReplyMarkup(undefined); // quitar el botón tras confirmar
    await ctx.reply(
      `✅ ¡Perfecto, ${empleado.nombre}!\n\nTu Telegram ha sido vinculado correctamente. Recibirás notificaciones sobre:\n• 📅 Horarios de entrada/salida\n• 🏖️ Días de descanso\n• 📢 Avisos importantes del almacén`
    );
    return;
  }

  // ── FLOTA ──
  if (data?.startsWith('confirm_flt_')) {
    const token = data.replace('confirm_flt_', '');

    const { data: flota, error } = await (supabase as any)
      .from('flota_perfil')
      .select('id, nombre_completo')
      .eq('telegram_token', token)
      .single();

    if (error || !flota) {
      await ctx.answerCallbackQuery({ text: 'Token inválido o expirado', show_alert: true });
      return;
    }

    const { error: upsertError } = await (supabase as any)
      .from('telegram_usuarios')
      .upsert({
        flota_id: flota.id,
        chat_id: chatId,
        nombre: flota.nombre_completo,  // nombre desde BD
        username,                        // username desde Telegram automáticamente
        tipo: 'flota',
        activo: true,
        ultimo_mensaje: ahora,
        updated_at: ahora,
      }, { onConflict: 'chat_id' });

    if (upsertError) {
      console.error('Error upsert telegram_usuarios (flota):', JSON.stringify(upsertError));
      await ctx.answerCallbackQuery({ text: 'Error interno, intenta de nuevo', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: '¡Vinculación exitosa! 🎉' });
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply(
      `✅ ¡Perfecto, ${flota.nombre_completo}!\n\nTu Telegram ha sido vinculado al sistema de flota. Recibirás notificaciones sobre:\n• 🚛 Cambios en tus rutas\n• ⏰ Horarios de carga/descarga\n• 📢 Avisos importantes`
    );
    return;
  }
});

// ================================================================
// POST: Recibir actualizaciones del webhook de Telegram
// ================================================================
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    await bot.handleUpdate(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en webhook Telegram:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}