import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Configurar el webhook (ejecutar UNA VEZ)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const setup = url.searchParams.get('setup');
  
  if (setup === 'true') {
    const webhookUrl = `https://tu-dominio.vercel.app/api/telegram-webhook`;
    
    const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    
    const data = await response.json();
    return NextResponse.json(data);
  }
  
  return NextResponse.json({ 
    message: 'Para configurar webhook, visita ?setup=true' 
  });
}

// Recibir mensajes de Telegram
export async function POST(request: Request) {
  try {
    const update = await request.json();
    
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text;
      const from = msg.from;
      const nombre = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
      
      console.log(`📨 Mensaje de ${nombre} (chatId: ${chatId}): ${text}`);
      
      // Buscar empleado por teléfono si está disponible en el mensaje
      const telefonoLimpio = msg.contact?.phone_number || null;
      
      if (telefonoLimpio) {
        // Usar 'as any' para evitar problemas de tipos
        const { data: empleado } = await (supabase as any)
          .from('empleados')
          .select('id')
          .eq('telefono', telefonoLimpio)
          .maybeSingle();
          
        if (empleado) {
          // ✅ SOLUCIÓN DEFINITIVA: usar 'as any' en toda la cadena
          await (supabase as any)
            .from('telegram_usuarios')
            .upsert({
              empleado_id: empleado.id,
              chat_id: chatId,
              nombre: nombre,
              username: from.username,
              activo: true,
              updated_at: new Date().toISOString()
            });
            
          console.log(`✅ chatId ${chatId} asociado a empleado ${empleado.id}`);
        } else {
          console.log('⚠️ No se encontró empleado con ese teléfono');
        }
      } else {
        console.log('⚠️ El mensaje no contiene número de teléfono');
      }
      
      // Responder automáticamente
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ Mensaje recibido. Usa /start para obtener tus credenciales.',
          parse_mode: 'Markdown'
        })
      });
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('❌ Error en webhook Telegram:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}