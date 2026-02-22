import { NextResponse } from 'next/server';

// ¡ESTA ES LA FUNCIÓN CLAVE! Maneja las solicitudes POST de Telegram
export async function POST(request: Request) {
  console.log("🚀 WEBHOOK POST RECIBIDO EN VERCEL");
  try {
    const body = await request.json();
    console.log("📦 Cuerpo del mensaje:", JSON.stringify(body, null, 2));

    // --- Aquí irá tu lógica de negocio (guardar en Supabase, etc.) ---

    // ¡RESPUESTA OBLIGATORIA! Siempre responde con un 200 OK.
    return NextResponse.json({ ok: true, message: "Recibido por Vercel" });

  } catch (error) {
    console.error("💥 Error procesando el webhook:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// (Opcional) Un GET simple para poder probar que el endpoint existe desde el navegador
export async function GET() {
  return NextResponse.json({
    message: "✅ Endpoint de webhook de Telegram activo. Esperando POST de Telegram."
  });
}