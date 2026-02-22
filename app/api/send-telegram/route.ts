import { NextResponse } from 'next/server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function POST(request: Request) {
  try {
    const { chatId, nombre, pin, documento_id } = await request.json();
    
    if (!chatId || !nombre || !pin || !documento_id) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // ✅ Mensaje con formato Markdown (soporta negritas, cursivas, etc.)
    const mensaje = `
🔐 *CREDENCIALES DE ACCESO*

Hola *${nombre}*,
Tu DNI/NIE/Doc: \`${documento_id}\`
Tu PIN de acceso es: *${pin}*

Puedes ingresar en: [almacen-final.vercel.app](https://almacen-final.vercel.app/)
    `;

    console.log('📤 Enviando mensaje Telegram a chatId:', chatId);

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: 'Markdown', // ✅ Telegram soporta Markdown [citation:3][citation:6]
        disable_web_page_preview: false
      })
    });

    const data = await response.json();
    
    if (data.ok) {
      return NextResponse.json({ 
        success: true, 
        message: 'Mensaje enviado por Telegram' 
      });
    } else {
      console.error('❌ Error Telegram:', data);
      return NextResponse.json(
        { success: false, error: data.description },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('❌ Error en send-telegram:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'API de Telegram activa',
    token: !!process.env.TELEGRAM_BOT_TOKEN ? '✓ Configurado' : '✗ No configurado'
  });
}