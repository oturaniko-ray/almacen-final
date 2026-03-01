import { NextRequest, NextResponse } from 'next/server';
import { Bot, InlineKeyboard } from 'grammy';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || 'placeholder');

// --- HANDLERS GLOBALES DE GRAMMY ---
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  if (text?.startsWith('/start')) {
    const token = text.split(' ')[1];
    if (!token) {
      await ctx.reply('🤖 Hola, usa el enlace que recibiste en tu correo.');
      return;
    }

    // Verificar si el token existe en empleados
    const { data: empleado, error } = await (supabase as any)
      .from('empleados')
      .select('id, nombre')
      .eq('telegram_token', token)
      .maybeSingle();

    if (error || !empleado) {
      await ctx.reply('❌ El enlace no es válido o ha expirado. Solicita un nuevo correo.');
      return;
    }

    // Mostramos botón de confirmación
    const keyboard = new InlineKeyboard().text(
      '✅ Confirmar recepción de correo',
      `confirm_${token}`
    );
    await ctx.reply(
      `Hola ${empleado.nombre}. Para activar las notificaciones, presiona el botón:`,
      { reply_markup: keyboard }
    );
  }
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (data?.startsWith('confirm_')) {
    const token = data.replace('confirm_', '');
    const from = ctx.callbackQuery.from;
    const chatId = from.id;
    const nombre = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
    const username = from.username || null;

    // Buscar empleado por token
    const { data: empleado, error } = await (supabase as any)
      .from('empleados')
      .select('id, nombre')
      .eq('telegram_token', token)
      .single();

    if (error || !empleado) {
      await ctx.answerCallbackQuery({ text: 'Token inválido', show_alert: true });
      return;
    }

    // Actualizar o crear registro en telegram_usuarios
    const { error: upsertError } = await (supabase as any)
      .from('telegram_usuarios')
      .upsert({
        empleado_id: empleado.id,
        chat_id: String(chatId),
        nombre,
        username,
        token_unico: token,
        activo: true,
        ultimo_mensaje: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'empleado_id' });

    if (upsertError) {
      console.error('Error upsert:', upsertError);
      await ctx.answerCallbackQuery({ text: 'Error interno', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: '¡Vinculación exitosa!' });
    await ctx.reply(`✅ Gracias ${empleado.nombre}. Ahora recibirás notificaciones por este canal.`);
  }
});

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Procesar actualización con grammY
    await bot.handleUpdate(payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error en webhook:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}