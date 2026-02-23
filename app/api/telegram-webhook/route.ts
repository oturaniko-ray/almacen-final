import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📨 Webhook recibido:', JSON.stringify(body, null, 2));

    if (body.message) {
      const msg = body.message;
      const chatId = msg.chat.id;
      const from = msg.from;
      const nombre = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
      const text = msg.text || '';

      // =====================================================
      // PASO 1: Guardar usuario de Telegram (siempre)
      // =====================================================
      await (supabase as any)
        .from('telegram_usuarios')
        .upsert({
          chat_id: chatId,
          nombre: nombre,
          username: from.username,
          activo: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'chat_id' });

      // =====================================================
      // PASO 2: Procesar comando /start con token
      // =====================================================
      if (text?.startsWith('/start')) {
        const token = text.split(' ')[1]; // /start TOKEN
        
        if (token) {
          console.log(`🔑 Token recibido: ${token}`);
          
          // Analizar token para saber si es empleado o flota
          if (token.startsWith('emp_')) {
            // Buscar empleado con ese token
            const { data: empleado } = await (supabase as any)
              .from('empleados')
              .select('id, nombre')
              .eq('telegram_token', token)
              .maybeSingle();
            
            if (empleado) {
              await (supabase as any)
                .from('telegram_usuarios')
                .update({ empleado_id: empleado.id })
                .eq('chat_id', chatId);
              
              // Limpiar token (usado)
              await (supabase as any)
                .from('empleados')
                .update({ telegram_token: null, telegram_token_expira: null })
                .eq('id', empleado.id);
              
              await fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `✅ ¡Vinculación exitosa, *${empleado.nombre}*! 🎉\n\nAhora recibirás aquí tus credenciales de acceso.`,
                  parse_mode: 'Markdown'
                })
              });
              
              return NextResponse.json({ ok: true });
            }
            
          } else if (token.startsWith('flt_')) {
            // Buscar perfil de flota con ese token
            const { data: flota } = await (supabase as any)
              .from('flota_perfil')
              .select('id, nombre_completo')
              .eq('telegram_token', token)
              .maybeSingle();
            
            if (flota) {
              await (supabase as any)
                .from('telegram_usuarios')
                .update({ flota_id: flota.id })
                .eq('chat_id', chatId);
              
              await (supabase as any)
                .from('flota_perfil')
                .update({ telegram_token: null, telegram_token_expira: null })
                .eq('id', flota.id);
              
              await fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `✅ ¡Vinculación exitosa, *${flota.nombre_completo}*! 🚛🎉\n\nAhora recibirás aquí las notificaciones de tu perfil de flota.`,
                  parse_mode: 'Markdown'
                })
              });
              
              return NextResponse.json({ ok: true });
            }
          }
          
          // Token no válido
          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `❌ El enlace no es válido o ha expirado.\n\nSolicita un nuevo enlace desde el sistema.`
            })
          });
        } else {
          // /start sin token
          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `👋 ¡Bienvenido al sistema de notificaciones, *${nombre}*!\n\nPara vincular tu cuenta, haz clic en el enlace que recibiste por correo electrónico.`,
              parse_mode: 'Markdown'
            })
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: "✅ Webhook de Telegram activo",
    timestamp: new Date().toISOString()
  });
}