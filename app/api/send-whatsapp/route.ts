import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET: Para verificación de Meta
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  // Verificar que el token coincida con tu variable de entorno
  const verifyToken = process.env.META_VERIFY_TOKEN || 'verificacionWhatsApp2026';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verificado por Meta');
    return new Response(challenge, { status: 200 });
  }

  console.log('❌ Verificación falló - token incorrecto');
  return new Response('Verification failed', { status: 403 });
}

// POST: Para recibir eventos de WhatsApp
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Responder inmediatamente a Meta (timeout de 5 segundos)
    // El procesamiento se hará en segundo plano
    const response = NextResponse.json({ status: 'ok' }, { status: 200 });

    // Procesar en segundo plano (no await)
    processWebhook(body).catch(error => {
      console.error('Error procesando webhook:', error);
    });

    return response;

  } catch (error) {
    console.error('Error en webhook POST:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Función para procesar el webhook en segundo plano
async function processWebhook(payload: any) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`\n📥 Webhook recibido ${timestamp}`);

    // Extraer datos del payload
    const entry = payload.entry?.[0];
    const wabaId = entry?.id;
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const field = changes?.field;

    if (!value) {
      console.log('⚠️ Webhook sin datos en value');
      return;
    }

    const metadata = value.metadata || {};
    const displayPhoneNumber = metadata.display_phone_number;
    const phoneNumberId = metadata.phone_number_id;

    console.log(`📞 Número: ${displayPhoneNumber} (ID: ${phoneNumberId})`);

    // Procesar mensajes entrantes (de empleados)
    if (value.messages) {
      for (const msg of value.messages) {
        await procesarMensajeEntrante(msg, {
          displayPhoneNumber,
          phoneNumberId,
          wabaId,
          from: value.contacts?.[0]?.wa_id
        });
      }
    }

    // Procesar estados de mensajes (sent, delivered, read)
    if (value.statuses) {
      for (const status of value.statuses) {
        await procesarEstadoMensaje(status, {
          displayPhoneNumber,
          phoneNumberId,
          wabaId
        });
      }
    }

  } catch (error) {
    console.error('❌ Error en processWebhook:', error);
  }
}

// Procesar mensaje entrante (cuando un empleado responde)
async function procesarMensajeEntrante(msg: any, context: any) {
  const messageId = msg.id;
  const from = msg.from; // Número del empleado
  const type = msg.type;
  const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

  console.log(`📨 Mensaje de ${from} (${type})`);

  let messageBody = '';
  let templateName = '';

  if (type === 'text') {
    messageBody = msg.text?.body || '';
  } else if (type === 'template') {
    templateName = msg.template?.name || '';
  }

  // Buscar a qué empleado pertenece este número
  const { data: empleado } = await supabase
    .from('empleados')
    .select('id, provincia_id')
    .eq('telefono', from)
    .maybeSingle();

  // Guardar en base de datos
  const { error } = await supabase
    .from('whatsapp_mensajes')
    .insert({
      message_id: messageId,
      wa_id: from,
      recipient_id: context.displayPhoneNumber,
      display_phone_number: context.displayPhoneNumber,
      message_type: type,
      message_body: messageBody,
      template_name: templateName,
      status: 'received',
      status_timestamp: timestamp.toISOString(),
      empleado_id: empleado?.id || null,
      provincia_id: empleado?.provincia_id || null,
      raw_payload: msg
    });

  if (error) {
    console.error('❌ Error guardando mensaje entrante:', error);
  } else {
    console.log(`✅ Mensaje ${messageId} guardado`);
  }
}

// Procesar cambios de estado (sent, delivered, read)
async function procesarEstadoMensaje(status: any, context: any) {
  const messageId = status.id;
  const statusType = status.status; // 'sent', 'delivered', 'read', 'failed'
  const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();
  const recipientId = status.recipient_id;

  console.log(`🔄 Estado de mensaje ${messageId}: ${statusType}`);

  // Verificar si ya existe el mensaje
  const { data: existente } = await supabase
    .from('whatsapp_mensajes')
    .select('id, status')
    .eq('message_id', messageId)
    .maybeSingle();

  if (existente) {
    // Actualizar estado
    const { error } = await supabase
      .from('whatsapp_mensajes')
      .update({
        status: statusType,
        status_timestamp: timestamp.toISOString(),
        pricing_category: status.pricing?.category,
        billable: status.pricing?.billable || false,
        raw_payload: status
      })
      .eq('message_id', messageId);

    if (error) {
      console.error('❌ Error actualizando estado:', error);
    } else {
      console.log(`✅ Estado actualizado: ${messageId} → ${statusType}`);
    }

  } else {
    // Si no existe, crear registro parcial (puede pasar con mensajes antiguos)
    const { error } = await supabase
      .from('whatsapp_mensajes')
      .insert({
        message_id: messageId,
        wa_id: recipientId,
        recipient_id: context.displayPhoneNumber,
        display_phone_number: context.displayPhoneNumber,
        status: statusType,
        status_timestamp: timestamp.toISOString(),
        pricing_category: status.pricing?.category,
        billable: status.pricing?.billable || false,
        raw_payload: status
      });

    if (error) {
      console.error('❌ Error creando registro parcial:', error);
    } else {
      console.log(`✅ Registro creado para estado: ${messageId}`);
    }
  }
}