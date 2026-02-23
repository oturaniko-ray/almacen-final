import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// ✅ SOLUCIÓN: Forzar modo dinámico
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Responder inmediatamente a Meta
    const response = NextResponse.json({ status: 'ok' }, { status: 200 });

    // Procesar en segundo plano
    processWebhook(body).catch(error => {
      console.error('Error procesando webhook:', error);
    });

    return response;

  } catch (error) {
    console.error('Error en webhook POST:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processWebhook(payload: any) {
  try {
    console.log('📥 Webhook recibido:', JSON.stringify(payload, null, 2));
    
    // Aquí va toda la lógica de procesamiento
    // ...
    
  } catch (error) {
    console.error('❌ Error en processWebhook:', error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'API de WhatsApp activa',
    token_configured: !!process.env.META_ACCESS_TOKEN
  });
}