import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function POST(request: Request) {
  try {
    const update = await request.json();
    console.log('📨 Webhook recibido:', JSON.stringify(update, null, 2));
    
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const from = msg.from;
      const nombre = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
      const text = msg.text || '';
      
      console.log(`📨 Mensaje de ${nombre} (chatId: ${chatId}): ${text}`);
      
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
      
      console.log(`✅ chatId ${chatId} guardado en telegram_usuarios`);
      
      // =====================================================
      // PASO 2: Procesar según el tipo de mensaje
      // =====================================================
      
      // Si es el comando /start, dar instrucciones
      if (text === '/start') {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `¡Bienvenido al sistema de notificaciones, *${nombre}*! 👋

Para vincular tu cuenta, **envía tu número de teléfono** (ej: 627411370).

Así podremos enviarte tus credenciales de acceso.`,
            parse_mode: 'Markdown'
          })
        });
        return NextResponse.json({ ok: true });
      }
      
      // =====================================================
      // PASO 3: Intentar asociar con empleado o flota por número de teléfono
      // =====================================================
      // Buscar número de teléfono en el mensaje (formato español)
      const telefonoMatch = text.match(/(\+34|0034)?[6-9]\d{8}/);
      
      if (telefonoMatch) {
        const telefonoLimpio = telefonoMatch[0];
        console.log(`📱 Teléfono detectado: ${telefonoLimpio}`);
        
        // Buscar en empleados
        const { data: empleado } = await (supabase as any)
          .from('empleados')
          .select('id, nombre')
          .eq('telefono', telefonoLimpio)
          .maybeSingle();
        
        if (empleado) {
          // Asociar con empleado
          await (supabase as any)
            .from('telegram_usuarios')
            .update({ empleado_id: empleado.id })
            .eq('chat_id', chatId);
          
          console.log(`✅ chatId ${chatId} asociado a empleado ${empleado.id} (${empleado.nombre})`);
          
          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ ¡Vinculación exitosa, *${empleado.nombre}*! 🎉

Ahora recibirás aquí tus credenciales de acceso cuando sean generadas.`,
              parse_mode: 'Markdown'
            })
          });
          
          return NextResponse.json({ ok: true });
        }
        
        // Buscar en flota_perfil
        const { data: flota } = await (supabase as any)
          .from('flota_perfil')
          .select('id, nombre_completo')
          .eq('telefono', telefonoLimpio)
          .maybeSingle();
        
        if (flota) {
          // Asociar con flota
          await (supabase as any)
            .from('telegram_usuarios')
            .update({ flota_id: flota.id })
            .eq('chat_id', chatId);
          
          console.log(`✅ chatId ${chatId} asociado a flota ${flota.id} (${flota.nombre_completo})`);
          
          await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ ¡Vinculación exitosa, *${flota.nombre_completo}*! 🚛🎉

Ahora recibirás aquí las notificaciones de tu perfil de flota.`,
              parse_mode: 'Markdown'
            })
          });
          
          return NextResponse.json({ ok: true });
        }
        
        // Si no se encontró en ninguna tabla
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `⚠️ No encontramos un registro con el teléfono *${telefonoLimpio}*.

Por favor, verifica que el número sea correcto o contacta al administrador.`,
            parse_mode: 'Markdown'
          })
        });
      } else {
        // Mensaje sin número de teléfono
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Para vincular tu cuenta, **envía tu número de teléfono** (ej: 627411370).`,
            parse_mode: 'Markdown'
          })
        });
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
    timestamp: new Date().toISOString(),
    endpoints: {
      setWebhook: "https://api.telegram.org/bot[TOKEN]/setWebhook?url=...",
      getWebhookInfo: "https://api.telegram.org/bot[TOKEN]/getWebhookInfo"
    }
  });
}