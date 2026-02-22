// app/api/telegram-webhook/route.ts
import { NextResponse } from 'next/server';

// Esta es la única función que importa para Telegram
export async function POST(request: Request) {
  console.log("🚀 WEBHOOK POST RECIBIDO EN VERCEL (versión mínima)");

  // Opcional: Intenta leer el body para ver si llega algo, pero no es obligatorio para que funcione
  try {
    const body = await request.json();
    console.log("Body recibido:", JSON.stringify(body, null, 2));
  } catch (e) {
    console.log("No se pudo parsear el body, pero la solicitud POST llegó.");
  }

  // La respuesta es simple y rápida. Telegram necesita un 200 OK.
  return NextResponse.json({ ok: true, message: "Webhook funcionando" });
}

// Opcional: Añade GET solo para probar que el endpoint existe.
export async function GET() {
  return NextResponse.json({ message: "✅ Endpoint de prueba GET activo" });
}