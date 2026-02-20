import { NextResponse } from 'next/server';

const RESPONDIO_API_TOKEN = process.env.RESPONDIO_API_TOKEN;
const BASE_URL = 'https://api.respond.io/v2';

export async function POST(request: Request) {
  try {
    const { to, nombre, pin, documento_id } = await request.json();
    
    if (!to || !nombre || !pin || !documento_id) {
      return NextResponse.json(
        { success: false, error: 'Teléfono, nombre, PIN y documento son requeridos' },
        { status: 400 }
      );
    }

    if (!RESPONDIO_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Token no configurado' },
        { status: 500 }
      );
    }

    const telefonoLimpio = to.replace(/\s+/g, '');
    const identifier = `phone:${telefonoLimpio}`;
    
    // ✅ Construir mensaje de texto
    const mensajeTexto = `Hola ${nombre}, 
Tu DNI/NIE/Doc: ${documento_id}
Tu PIN de acceso es: ${pin}
Puedes ingresar en: https://almacen-final.vercel.app/`;

    // ✅ Usar EXACTAMENTE la misma estructura que funcionó en la prueba
    const url = `${BASE_URL}/contact/${identifier}/message`;
    
    const payload = {
      text: mensajeTexto  // <-- SOLO text, sin channelId ni message.type
    };

    console.log('📤 Enviando mensaje:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESPONDIO_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.text();
    console.log('📥 Respuesta:', response.status, result);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Error: ${result}` },
        { status: response.status }
      );
    }

    // ✅ Parsear la respuesta exitosa
    const data = JSON.parse(result);
    
    return NextResponse.json({
      success: true,
      message: 'WhatsApp enviado correctamente',
      contactId: data.contactId,
      data: data
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'API de WhatsApp activa',
    token_configured: !!RESPONDIO_API_TOKEN,
    base_url: BASE_URL
  });
}