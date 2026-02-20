import { NextResponse } from 'next/server';

const RESPONDIO_API_TOKEN = process.env.RESPONDIO_API_TOKEN;
const BASE_URL = 'https://api.respond.io/v2';
const WHATSAPP_CHANNEL_ID = 1;

// Función para enviar mensaje de texto
async function sendTextMessage(contactId: string, text: string, token: string) {
  const url = `${BASE_URL}/contact/id:${contactId}/message`;
  const payload = {
    channelId: WHATSAPP_CHANNEL_ID,
    message: { 
      type: 'text', 
      text: text 
    }
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  return response;
}

// Función para enviar plantilla de WhatsApp - VERSIÓN CORREGIDA
async function sendTemplateMessage(contactId: string, nombre: string, documento_id: string, pin: string, token: string) {
  const url = `${BASE_URL}/contact/id:${contactId}/message`;
  
  // Según la documentación, la estructura correcta para plantillas
  const payload = {
    channelId: WHATSAPP_CHANNEL_ID,
    message: {
      type: 'template', // Cambiado de 'whatsappTemplate' a 'template'
      template: {
        name: 'credenciales_acceso',
        language: 'es',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: nombre },
              { type: 'text', text: documento_id },
              { type: 'text', text: pin }
            ]
          }
        ]
      }
    }
  };
  
  console.log('📤 Enviando plantilla con payload:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  return response;
}

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

    // Construir mensaje de texto
    const mensajeTexto = `Hola ${nombre}, 
Tu DNI/NIE/Doc: ${documento_id}
Tu PIN de acceso es: ${pin}
Puedes ingresar en: https://almacen-final.vercel.app/`;

    // Intentar enviar mensaje de texto primero
    console.log('📤 Intentando enviar mensaje de texto...');
    const textResponse = await sendTextMessage(contactId, mensajeTexto, RESPONDIO_API_TOKEN);
    const textResult = await textResponse.text();

    if (textResponse.ok) {
      console.log('✅ Mensaje de texto enviado');
      return NextResponse.json({
        success: true,
        message: 'WhatsApp enviado correctamente'
      });
    }

    // Si falla por "no interaction", intentar con plantilla
    if (textResponse.status === 404 && textResult.includes('no interaction')) {
      console.log('🔄 Contacto nuevo, intentando con plantilla...');
      
      const templateResponse = await sendTemplateMessage(
        contactId, 
        nombre,
        documento_id,
        pin,
        RESPONDIO_API_TOKEN
      );
      
      const templateResult = await templateResponse.text();
      console.log('📥 Respuesta plantilla:', templateResponse.status, templateResult);
      
      if (templateResponse.ok) {
        return NextResponse.json({
          success: true,
          message: 'WhatsApp enviado con plantilla'
        });
      } else {
        return NextResponse.json(
          { success: false, error: `Error con plantilla: ${templateResult}` },
          { status: templateResponse.status }
        );
      }
    }

    // Otro tipo de error
    return NextResponse.json(
      { success: false, error: `Error: ${textResult}` },
      { status: textResponse.status }
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
    channel_id: WHATSAPP_CHANNEL_ID
  });
}