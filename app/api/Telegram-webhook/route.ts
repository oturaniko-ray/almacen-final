import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function POST(request: Request) {
  try {
    const update = await request.json();
    
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;  // ← ESTE ES EL ID CORRECTO
      const from = msg.from;
      const nombre = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
      
      console.log(`📨 Mensaje de ${nombre} (chatId: ${chatId})`);
      
      // Buscar empleado por teléfono (si está disponible)
      // O puedes buscar por username/email
      
      // Guardar o actualizar el chat_id en tu base de datos
      await (supabase as any)
        .from('telegram_usuarios')
        .upsert({
          chat_id: chatId,
          nombre: nombre,
          username: from.username,
          activo: true,
          updated_at: new Date().toISOString()
        });
      
      console.log(`✅ chatId ${chatId} guardado`);
      
      // Responder al usuario
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ ¡Bienvenido! Tus credenciales se enviarán automáticamente.',
          parse_mode: 'Markdown'
        })
      });
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}