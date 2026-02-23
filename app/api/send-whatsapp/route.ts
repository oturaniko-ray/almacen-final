import { NextResponse } from 'next/server';

const META_API_VERSION = 'v22.0';
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export async function POST(request: Request) {
  try {
    const { to, nombre, pin, documento_id } = await request.json();
    
    if (!to || !nombre || !pin || !documento_id) {
      return NextResponse.json(
        { success: false, error: 'Teléfono, nombre, PIN y documento son requeridos' },
        { status: 400 }
      );
    }

    const accessToken = process.env.META_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        { success: false, error: 'Meta WhatsApp no configurado' },
        { status: 500 }
      );
    }

    const telefonoLimpio = to.replace(/\s+/g, '');
    
    // Construir mensaje de texto (para contactos existentes)
    const mensajeTexto = `Hola ${nombre}, 
Tu DNI/NIE/Doc: ${documento_id}
Tu PIN de acceso es: ${pin}
Puedes ingresar en: https://almacen-final.vercel.app/`;

    const url = `${META_GRAPH_URL}/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: telefonoLimpio,
      type: 'text',
      text: { body: mensajeTexto }
    };

    console.log('📤 Enviando mensaje a Meta:', {
      url,
      to: telefonoLimpio,
      tipo: 'texto'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('📥 Respuesta Meta:', response.status, responseText);

    if (!response.ok) {
      // Intentar parsear el error
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { raw: responseText };
      }

      // Si el error es porque el contacto es nuevo (requiere plantilla)
      if (errorData.error?.code === 132016) { // Código de error para contactos nuevos
        return NextResponse.json({
          success: false,
          error: 'CONTACTO_NUEVO',
          message: 'Este contacto requiere plantilla aprobada',
          details: errorData
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        error: `Error ${response.status}`,
        details: errorData
      }, { status: response.status });
    }

    // Parsear respuesta exitosa
    const data = JSON.parse(responseText);
    
    return NextResponse.json({
      success: true,
      message: 'WhatsApp enviado correctamente',
      data: data
    });

  } catch (error: any) {
    console.error('❌ Error en send-whatsapp:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'API de WhatsApp activa',
    provider: 'Meta Cloud API',
    phone_number_id: process.env.META_PHONE_NUMBER_ID ? '✓ Configurado' : '✗ No configurado',
    token: process.env.META_ACCESS_TOKEN ? '✓ Configurado' : '✗ No configurado'
  });
}