import { NextResponse } from 'next/server';

// Maneja las solicitudes POST (las que envía Telegram)
export async function POST(request: Request) {
  console.log('✅ WEBHOOK POST RECIBIDO');
  try {
    const body = await request.json();
    console.log('📦 Body:', JSON.stringify(body, null, 2));
    return NextResponse.json({ ok: true, recibido: true });
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// Maneja las solicitudes GET (para pruebas desde navegador)
export async function GET() {
  return NextResponse.json({ 
    message: '✅ Webhook de Telegram activo',
    instrucciones: 'Envía un POST con el cuerpo de Telegram'
  });
}