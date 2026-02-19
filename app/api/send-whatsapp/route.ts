import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { to, message, programacionId } = await request.json();

    // Validar datos básicos
    if (!to || !message) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos: número (to) o mensaje (message)' },
        { status: 400 }
      );
    }

    // Validar formato del teléfono
    const numeroLimpio = to.replace(/[^0-9]/g, '');
    if (numeroLimpio.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Número de teléfono inválido' },
        { status: 400 }
      );
    }

    // Verificar que tenemos la API key
    if (!process.env.RESPONDIO_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'API key de respond.io no configurada' },
        { status: 500 }
      );
    }

    console.log('📱 Enviando WhatsApp a:', numeroLimpio);
    console.log('📱 Mensaje:', message);

    // ✅ CORRECCIÓN: Usar el endpoint correcto de la API v2
    const response = await fetch('https://api.respond.io/v2/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESPONDIO_API_KEY}`,
      },
      body: JSON.stringify({
        // Según la documentación de la API v2 [citation:7]
        to: numeroLimpio,
        message: {
          text: message,
        },
      }),
    });

    // ✅ IMPORTANTE: Verificar si la respuesta es JSON antes de parsear
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Si no es JSON, es un error HTML
      const text = await response.text();
      console.error('❌ Respuesta no JSON:', text.substring(0, 200));
      throw new Error(`API respond.io respondió con ${response.status}: ${response.statusText}`);
    }

    const success = response.ok;

    console.log('📱 Respuesta de respond.io:', { success, data });

    // Guardar log en Supabase
    await (supabase as any)
      .from('notificaciones_whatsapp')
      .insert([{
        programacion_id: programacionId,
        destinatario: to,
        mensaje: message,
        estado: success ? 'enviado' : 'fallido',
        error: success ? null : data.message || 'Error desconocido',
        enviado_en: success ? new Date().toISOString() : null,
      }]);

    if (!success) {
      return NextResponse.json(
        { success: false, error: data.message || 'Error al enviar mensaje' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      messageId: data.id,
      data,
      message: `WhatsApp enviado correctamente a ${numeroLimpio}`
    });

  } catch (error: any) {
    console.error('❌ Error en API send-whatsapp:', error);
    
    // Intentar guardar el error en el log
    try {
      const { to, message, programacionId } = await request.clone().json();
      await (supabase as any)
        .from('notificaciones_whatsapp')
        .insert([{
          programacion_id: programacionId,
          destinatario: to,
          mensaje: message,
          estado: 'fallido',
          error: error.message || 'Error interno',
          enviado_en: null,
        }]);
    } catch (logError) {
      console.error('Error guardando log:', logError);
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}