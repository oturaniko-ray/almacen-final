import { NextResponse } from 'next/server';

const RESPONDIO_API_TOKEN = process.env.RESPONDIO_API_TOKEN;
const BASE_URL = 'https://api.respond.io/v2';
const WHATSAPP_CHANNEL_ID = 1;

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
    
    // Buscar el contacto para obtener su ID
    console.log('🔍 Buscando contacto:', identifier);
    const searchUrl = `${BASE_URL}/contact/${identifier}`;
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${RESPONDIO_API_TOKEN}` },
    });

    if (!searchResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Contacto no encontrado en Respond.io' },
        { status: 404 }
      );
    }

    const contactData = await searchResponse.json();
    const contactId = contactData.id;
    console.log('✅ Contacto encontrado, ID:', contactId);

    // ✅ Mensaje de texto simple con nombre, documento y PIN
    const mensajeTexto = `Hola *${nombre}*, 
Tu *DNI/NIE/Documento*: ${documento_id}
Tu *PIN de acceso* es: ${pin}
Puedes ingresar en: https://almacen-final.vercel.app/`;

    // Enviar mensaje de texto directamente
    console.log('📤 Enviando mensaje de texto...');
    
    const url = `${BASE_URL}/contact/id:${contactId}/message`;
    const payload = {
      channelId: WHATSAPP_CHANNEL_ID,
      message: { 
        type: 'text', 
        text: mensajeTexto 
      }
    };

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
      // Si el error es por "no interaction", el contacto es nuevo
      if (result.includes('no interaction')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Este contacto es nuevo. WhatsApp requiere una plantilla aprobada para el primer mensaje. La plantilla está en proceso de aprobación por Meta.' 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: `Error: ${result}` },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp enviado correctamente'
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
    channel_id: WHATSAPP_CHANNEL_ID
  });
}