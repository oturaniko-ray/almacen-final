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

    // ✅ ESTRUCTURA CORRECTA PARA MENSAJES (NO para comentarios)
    const url = `${BASE_URL}/contact/${identifier}/message`;
    
    const payload = {
      message: {
        type: 'text',
        text: mensajeTexto
      }
    };

    console.log('📤 URL:', url);
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
    console.log('📥 Respuesta:', responseText);

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Error ${response.status}`,
          details: responseText 
        },
        { status: response.status }
      );
    }

    // Intentar parsear respuesta exitosa
    try {
      const data = JSON.parse(responseText);
      return NextResponse.json({
        success: true,
        message: 'WhatsApp enviado correctamente',
        data: data
      });
    } catch {
      return NextResponse.json({
        success: true,
        message: 'WhatsApp enviado correctamente'
      });
    }

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
    token_configured: !!RESPONDIO_API_TOKEN
  });
}