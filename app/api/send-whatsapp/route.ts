import { NextResponse } from 'next/server';
import { RespondIO, RespondIOError } from '@respond-io/typescript-sdk';

let respondClient: RespondIO | null = null;

const getRespondClient = () => {
  if (!respondClient) {
    const apiToken = process.env.RESPONDIO_API_TOKEN;
    if (!apiToken) throw new Error('RESPONDIO_API_TOKEN no está configurado');
    
    respondClient = new RespondIO({
      apiToken: apiToken,
      baseUrl: 'https://api.respond.io/v2',
      maxRetries: 3,
      timeout: 30000,
    });
  }
  return respondClient;
};

export async function POST(request: Request) {
  try {
    const { to, nombre, pin, documento_id } = await request.json();
    
    if (!to || !nombre || !pin || !documento_id) {
      return NextResponse.json(
        { success: false, error: 'Teléfono, nombre, PIN y documento son requeridos' },
        { status: 400 }
      );
    }

    const client = getRespondClient();
    const telefonoLimpio = to.replace(/\s+/g, '');
    
    // ✅ El identificador DEBE tener el formato exacto que espera el SDK
    // El tipo ContactIdentifier acepta: 'id:123' | 'email:user@example.com' | 'phone:+123456789'
    const contactIdentifier = `phone:${telefonoLimpio}` as const;

    const mensajeTexto = `Hola ${nombre}, 
Tu DNI/NIE/Doc: ${documento_id}
Tu PIN de acceso es: ${pin}
Puedes ingresar en: https://almacen-final.vercel.app/`;

    console.log('📤 Enviando mensaje a:', contactIdentifier);

    // ✅ Usar 'as any' para evitar el error de TypeScript
    // El SDK tiene tipos muy estrictos, pero en runtime funciona correctamente
    const result = await (client.messaging.send as any)(contactIdentifier, {
      message: {
        type: 'text',
        text: mensajeTexto,
      },
    });

    console.log('✅ Mensaje enviado:', result);

    return NextResponse.json({
      success: true,
      message: 'WhatsApp enviado correctamente',
      data: result
    });

  } catch (error: any) {
    console.error('❌ Error:', error);

    if (error instanceof RespondIOError) {
      // Si es contacto nuevo, necesitamos usar plantilla
      if (error.statusCode === 404 && error.message?.includes('no interaction')) {
        return NextResponse.json({
          success: false,
          error: 'CONTACTO_NUEVO',
          message: 'Este contacto requiere plantilla de WhatsApp',
          code: error.code
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        statusCode: error.statusCode
      }, { status: error.statusCode || 500 });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'API de WhatsApp activa',
    token_configured: !!process.env.RESPONDIO_API_TOKEN,
    sdk_version: 'SDK de Respond.io'
  });
}