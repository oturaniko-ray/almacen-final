import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { BienvenidaEmpleado } from '../../../emails/BienvenidaEmpleado';

export async function POST(request: Request) {
  try {
    // Verificar que la API key está definida
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY no está definida en el entorno');
      return NextResponse.json(
        { error: 'Error de configuración del servidor: falta API key' },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { nombre, documento_id, email, rol, nivel_acceso, pin_seguridad, to } = await request.json();

    if (!nombre || !email || !pin_seguridad) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    const from = process.env.NODE_ENV === 'production'
      ? 'sistema@tudominio.com'   // ← CAMBIA POR TU DOMINIO VERIFICADO EN PRODUCCIÓN
      : 'onboarding@resend.dev';   // ← Para desarrollo, usa la dirección de prueba

    const { data, error } = await resend.emails.send({
      from,
      to: to || email,
      subject: 'Bienvenido al Sistema - Credenciales de Acceso',
      react: BienvenidaEmpleado({
        nombre,
        documento_id,
        email,
        rol,
        nivel_acceso,
        pin_seguridad,
      }),
    });

    if (error) {
      console.error('❌ Error de Resend:', error);
      return NextResponse.json(
        { error: `Error de Resend: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('✅ Correo enviado correctamente:', data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Error en API send-email:', error);
    return NextResponse.json(
      { error: `Error interno: ${error.message}` },
      { status: 500 }
    );
  }
}