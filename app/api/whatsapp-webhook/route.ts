import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET: Para verificación de Meta
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

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
    
    const response = NextResponse.json({ status: 'ok' }, { status: 200 });

    // Procesar en segundo plano
    processWebhook(body).catch(error => {
      console.error('Error procesando webhook:', error);
    });

    return response;

  } catch (error) {
    console.error('Error en webhook POST:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processWebhook(payload: any) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`\n📥 Webhook recibido ${timestamp}`);

    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      console.log('⚠️ Webhook sin datos en value');
      return;
    }

    const metadata = value.metadata || {};
    const displayPhoneNumber = metadata.display_phone_number;
    const phoneNumberId = metadata.phone_number_id;

    console.log(`📞 Número: ${displayPhoneNumber} (ID: ${phoneNumberId})`);

    // Procesar mensajes entrantes
    if (value.messages) {
      for (const msg of value.messages) {
        await procesarMensajeEntrante(msg, {
          displayPhoneNumber,
          phoneNumberId,
          from: value.contacts?.[0]?.wa_id
        });
      }
    }

    // Procesar estados
    if (value.statuses) {
      for (const status of value.statuses) {
        await procesarEstadoMensaje(status, {
          displayPhoneNumber,
          phoneNumberId
        });
      }
    }

  } catch (error) {
    console.error('❌ Error en processWebhook:', error);
  }
}

async function procesarMensajeEntrante(msg: any, context: any) {
  const messageId = msg.id;
  const from = msg.from;
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

  // Buscar empleado
  const { data: empleado } = await supabase
    .from('empleados')
    .select('id, provincia_id')
    .eq('telefono', from)
    .maybeSingle();

  // ✅ SOLUCIÓN: usar 'as never' para evitar el error de TypeScript
  const { error } = await supabase
    .from('whatsapp_mensajes')
    .insert([{
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
    } as never]);

  if (error) {
    console.error('❌ Error guardando mensaje entrante:', error);
  } else {
    console.log(`✅ Mensaje ${messageId} guardado`);
  }
}

async function procesarEstadoMensaje(status: any, context: any) {
  const messageId = status.id;
  const statusType = status.status;
  const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();
  const recipientId = status.recipient_id;

  console.log(`🔄 Estado de mensaje ${messageId}: ${statusType}`);

  // Verificar si existe
  const { data: existente } = await supabase
    .from('whatsapp_mensajes')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle();

  if (existente) {
    // Actualizar
    const { error } = await supabase
      .from('whatsapp_mensajes')
      .update({
        status: statusType,
        status_timestamp: timestamp.toISOString(),
        pricing_category: status.pricing?.category,
        billable: status.pricing?.billable || false,
        raw_payload: status
      } as never)
      .eq('message_id', messageId);

    if (error) {
      console.error('❌ Error actualizando estado:', error);
    } else {
      console.log(`✅ Estado actualizado: ${messageId} → ${statusType}`);
    }

  } else {
    // Crear nuevo
    const { error } = await supabase
      .from('whatsapp_mensajes')
      .insert([{
        message_id: messageId,
        wa_id: recipientId,
        recipient_id: context.displayPhoneNumber,
        display_phone_number: context.displayPhoneNumber,
        status: statusType,
        status_timestamp: timestamp.toISOString(),
        pricing_category: status.pricing?.category,
        billable: status.pricing?.billable || false,
        raw_payload: status
      } as never]);

    if (error) {
      console.error('❌ Error creando registro parcial:', error);
    } else {
      console.log(`✅ Registro creado para estado: ${messageId}`);
    }
  }
}