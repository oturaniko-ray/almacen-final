import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const RESPONDIO_API_TOKEN = process.env.RESPONDIO_API_TOKEN;
const BASE_URL = 'https://api.respond.io/v2';
const WHATSAPP_CHANNEL_ID = 1; // El ID que ya tienes

// Función para enviar mensaje de texto
async function sendTextMessage(contactId: string, text: string, token: string) {
  const url = `${BASE_URL}/contact/id:${contactId}/message`;
  const payload = {
    channelId: WHATSAPP_CHANNEL_ID,
    message: { type: 'text', text }
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

// Función para enviar plantilla de WhatsApp
async function sendTemplateMessage(contactId: string, nombre: string, pin: string, token: string) {
  const url = `${BASE_URL}/contact/id:${contactId}/message`;
  const payload = {
    channelId: WHATSAPP_CHANNEL_ID,
    message: {
      type: 'whatsappTemplate',
      template: {
        name: 'credenciales_acceso', // Crea esta plantilla en Respond.io
        language: 'es',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: nombre },
              { type: 'text', text: pin }
            ]
          }
        ]
      }
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

export async function POST(request: Request) {
  try {
    const { to, message, nombre, pin } = await request.json();
    
    if (!to || !message) {
      return NextResponse.json(
        { success: false, error: 'Teléfono y mensaje requeridos' },
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

    // Intentar enviar mensaje de texto
    console.log('📤 Intentando enviar mensaje de texto...');
    const textResponse = await sendTextMessage(contactId, message, RESPONDIO_API_TOKEN);
    const textResult = await textResponse.text();

    if (textResponse.ok) {
      console.log('✅ Mensaje de texto enviado');
      return NextResponse.json({
        success: true,
        message: 'WhatsApp enviado correctamente',
        data: JSON.parse(textResult)
      });
    }

    // Si falla por "no interaction", intentar con plantilla
    if (textResponse.status === 404 && textResult.includes('no interaction')) {
      console.log('🔄 Contacto nuevo, intentando con plantilla...');
      
      if (!pin) {
        return NextResponse.json(
          { success: false, error: 'Se requiere PIN para plantilla' },
          { status: 400 }
        );
      }

      const templateResponse = await sendTemplateMessage(
        contactId, 
        nombre || 'Empleado', 
        pin, 
        RESPONDIO_API_TOKEN
      );
      
      const templateResult = await templateResponse.text();
      
      if (templateResponse.ok) {
        return NextResponse.json({
          success: true,
          message: 'WhatsApp enviado con plantilla',
          data: JSON.parse(templateResult)
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