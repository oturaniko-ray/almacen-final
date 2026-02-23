import { NextResponse } from 'next/server';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export async function POST(request: Request) {
  try {
    const { to, message } = await request.json();
    
    if (!to || !message) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    if (!TELEGRAM_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Token de Telegram no configurado' },
        { status: 500 }
      );
    }

    // Buscar el chat_id asociado al teléfono
    // Por ahora, simulamos que el teléfono es el chat_id (en producción debes buscar en la tabla telegram_usuarios)
    const chatId = to;

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();
    
    if (data.ok) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: data.description },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error en send-telegram:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'API de Telegram',
    token: !!process.env.TELEGRAM_BOT_TOKEN ? '✓ Configurado' : '✗ No configurado'
  });
}