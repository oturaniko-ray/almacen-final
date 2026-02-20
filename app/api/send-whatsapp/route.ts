import { NextResponse } from 'next/server';

const WHATSAPP_CHANNEL_ID = 1; // Asumiendo que este es tu ID de canal
const RESPONDIO_API_TOKEN = process.env.RESPONDIO_API_TOKEN;
const BASE_URL = 'https://api.respond.io/v2';

export async function POST(request: Request) {
  try {
    // 1. RECIBIR DATOS DEL EMPLEADO
    const { to, message, nombre, email } = await request.json();
    if (!to || !message || !nombre) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos: teléfono, mensaje y nombre' },
        { status: 400 }
      );
    }

    // 2. VALIDAR CONFIGURACIÓN
    if (!RESPONDIO_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'RESPONDIO_API_TOKEN no configurado' },
        { status: 500 }
      );
    }

    const telefonoLimpio = to.replace(/\s+/g, '');
    // El identificador para la URL debe tener el formato phone:+123456789
    const identifier = `phone:${telefonoLimpio}`;

    // 3. PREPARAR EL PAYLOAD PARA RESPOND.IO (SEGÚN LA DOCUMENTACIÓN)
    const nameParts = nombre.split(' ');
    const firstName = nameParts[0] || 'Empleado';
    const lastName = nameParts.slice(1).join(' ') || '';

    const contactPayload = {
      firstName: firstName,
      lastName: lastName,
      phone: telefonoLimpio,
      email: email || `${firstName}.${lastName}@ejemplo.com`, // Email temporal si no se provee
      language: 'es',
      // Incluye solo los campos que la documentación de Respond.io acepta
    };

    console.log('📤 Creando/Actualizando contacto en Respond.io con payload:', contactPayload);

    // 4. LLAMADA A LA API DE RESPOND.IO PARA CREAR/ACTUALIZAR EL CONTACTO
    // Usamos el endpoint POST /contact/{identifier} como se muestra en tu documentación
    const createContactUrl = `${BASE_URL}/contact/${identifier}`;
    const createResponse = await fetch(createContactUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESPONDIO_API_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });

    const createResponseText = await createResponse.text();
    console.log(`📥 Respuesta de creación de contacto (${createResponse.status}):`, createResponseText);

    let contactId: string | null = null;
    if (createResponse.ok) {
      try {
        const contactData = JSON.parse(createResponseText);
        // La respuesta debería incluir el ID del contacto en Respond.io
        contactId = contactData.id ? String(contactData.id) : null;
        console.log('✅ Contacto asegurado en Respond.io con ID:', contactId);
      } catch (e) {
        console.warn('⚠️ No se pudo parsear la respuesta de creación, pero la llamada fue exitosa.');
      }
    } else {
      // Si la creación falla, no podemos continuar
      return NextResponse.json(
        {
          success: false,
          error: `Error al crear/actualizar contacto en Respond.io: ${createResponse.status}`,
          details: createResponseText,
        },
        { status: 500 }
      );
    }

    // Si por alguna razón no obtuvimos un ID, intentamos obtenerlo con una búsqueda (GET)
    if (!contactId) {
      console.log('🔍 ID no obtenido en creación, intentando obtener contacto por GET...');
      const getContactUrl = `${BASE_URL}/contact/${identifier}`;
      const getResponse = await fetch(getContactUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${RESPONDIO_API_TOKEN}` },
      });
      if (getResponse.ok) {
        const contactData = await getResponse.json();
        contactId = contactData.id ? String(contactData.id) : null;
        console.log('✅ Contacto encontrado por GET con ID:', contactId);
      } else {
        return NextResponse.json(
          { success: false, error: 'No se pudo verificar la existencia del contacto en Respond.io' },
          { status: 500 }
        );
      }
    }

    // 5. AHORA QUE EL CONTACTO EXISTE EN RESPOND.IO, ENVIAMOS EL MENSAJE
    const sendMessageUrl = `${BASE_URL}/contact/id:${contactId}/message`;
    const messagePayload = {
      channelId: WHATSAPP_CHANNEL_ID,
      message: { type: 'text', text: message },
    };

    console.log('📤 Enviando mensaje a Respond.io:', { url: sendMessageUrl, payload: messagePayload });

    const sendResponse = await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESPONDIO_API_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const sendResponseText = await sendResponse.text();
    console.log(`📥 Respuesta de envío (${sendResponse.status}):`, sendResponseText);

    if (!sendResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Error al enviar mensaje (${sendResponse.status})`,
          details: sendResponseText,
        },
        { status: sendResponse.status }
      );
    }

    // 6. RESPUESTA EXITOSA
    return NextResponse.json({
      success: true,
      message: 'WhatsApp enviado correctamente',
      data: JSON.parse(sendResponseText),
      respondio_contact_id: contactId,
    });
  } catch (error: any) {
    console.error('❌ Error general en la API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'API de WhatsApp activa',
    token_configured: !!process.env.RESPONDIO_API_TOKEN,
    channel_id: WHATSAPP_CHANNEL_ID,
  });
}