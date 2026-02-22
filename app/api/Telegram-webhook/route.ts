import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// ✅ IMPORTANTE: Función GET para verificar que el endpoint existe
export async function GET() {
  return NextResponse.json({ 
    message: '✅ Webhook de Telegram activo',
    instrucciones: 'Envía un mensaje a @Notificaacceso_bot para registrar tu chat_id'
  });
}

export async function POST(request: Request) {
  try {
    const update = await request.json();
    
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const from = msg.from;
      const nombre = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
      
      console.log(`📨 Mensaje de ${nombre} (chatId: ${chatId})`);
      
      // =====================================================
      // PASO 1: Verificar si el mensaje contiene un número de teléfono
      // =====================================================
      let empleadoId = null;
      
      // Si el usuario compartió su contacto (número de teléfono)
      if (msg.contact?.phone_number) {
        const telefonoLimpio = msg.contact.phone_number.replace(/\s+/g, '');
        
        console.log(`📱 Teléfono compartido: ${telefonoLimpio}`);
        
        // Buscar empleado por teléfono
        const { data: empleado } = await (supabase as any)
          .from('empleados')
          .select('id')
          .eq('telefono', telefonoLimpio)
          .maybeSingle();
          
        if (empleado) {
          empleadoId = empleado.id;
          console.log(`✅ Empleado encontrado: ${empleadoId}`);
        }
      }
      
      // También se puede buscar por el texto del mensaje si contiene el teléfono
      if (!empleadoId && msg.text) {
        // Buscar un patrón de teléfono en el mensaje (+34...)
        const telefonoMatch = msg.text.match(/\+?\d{9,13}/);
        if (telefonoMatch) {
          const telefonoEncontrado = telefonoMatch[0];
          
          const { data: empleado } = await (supabase as any)
            .from('empleados')
            .select('id')
            .eq('telefono', telefonoEncontrado)
            .maybeSingle();
            
          if (empleado) {
            empleadoId = empleado.id;
            console.log(`✅ Empleado encontrado por teléfono en mensaje: ${empleadoId}`);
          }
        }
      }
      
      // =====================================================
      // PASO 2: Guardar o actualizar el usuario de Telegram
      // =====================================================
      const upsertData: any = {
        chat_id: chatId,
        nombre: nombre,
        username: from.username,
        activo: true,
        updated_at: new Date().toISOString()
      };
      
      // Si encontramos el empleado, lo asociamos
      if (empleadoId) {
        upsertData.empleado_id = empleadoId;
      }
      
      await (supabase as any)
        .from('telegram_usuarios')
        .upsert(upsertData, { onConflict: 'chat_id' });
      
      console.log(`✅ chatId ${chatId} guardado ${empleadoId ? 'asociado a empleado' : 'sin asociar'}`);
      
      // =====================================================
      // PASO 3: Responder al usuario
      // =====================================================
      let respuesta = '✅ ¡Bienvenido! ';
      
      if (empleadoId) {
        respuesta += 'Tu cuenta ha sido vinculada correctamente. Recibirás tus credenciales aquí.';
      } else {
        respuesta += 'Para vincular tu cuenta, envía tu número de teléfono o comparte tu contacto.';
      }
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: respuesta,
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