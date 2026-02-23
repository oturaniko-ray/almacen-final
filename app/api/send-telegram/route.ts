import { NextResponse } from 'next/server';

// ✅ FORZAR MODO DINÁMICO
export const dynamic = 'force-dynamic';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export async function POST(request: Request) {
  try {
    // ✅ CORREGIDO: Esperar los parámetros correctos que envía el frontend
    const { chat_id, text } = await request.json();
    
    if (!chat_id || !text) {
      return NextResponse.json(
        { ok: false, error: 'Faltan chat_id o text' },
        { status: 400 }
      );
    }

    if (!TELEGRAM_TOKEN) {
      return NextResponse.json(
        { ok: false, error: 'Token de Telegram no configurado' },
        { status: 500 }
      );
    }

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat_id,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();
    
    if (data.ok) {
      return NextResponse.json({ ok: true });
    } else {
      return NextResponse.json(
        { ok: false, error: data.description },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error en send-telegram:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}