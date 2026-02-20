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
    
    const mensajeTexto = `Hola ${nombre}, 
Tu DNI/NIE/Doc: ${documento_id}
Tu PIN de acceso es: ${pin}
Puedes ingresar en: https://almacen-final.vercel.app/`;

    // ✅ ENDPOINT CORRECTO PARA MENSAJES
    const url = `${BASE_URL}/contact/${identifier}/message`;
    
    const payload = {
      text: mensajeTexto
    };

    console.log('📤 Enviando mensaje a:', url);
    console.log('📤 Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESPONDIO_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('📥 Status:', response.status);
    console.log('📥 Respuesta completa:', responseText);

    // Si la respuesta es exitosa pero vacía o no es JSON
    if (response.ok) {
      // Intentar parsear si es JSON
      try {
        const data = JSON.parse(responseText);
        return NextResponse.json({
          success: true,
          message: 'WhatsApp enviado correctamente',
          data: data
        });
      } catch {
        // Si no es JSON, asumimos éxito
        return NextResponse.json({
          success: true,
          message: 'WhatsApp enviado correctamente',
          rawResponse: responseText
        });
      }
    }

    // Manejo de errores
    return NextResponse.json(
      { 
        success: false, 
        error: `Error ${response.status}`,
        details: responseText 
      },
      { status: response.status }
    );

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