import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { BienvenidaEmpleado } from '../../../emails/BienvenidaEmpleado';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { nombre, documento_id, email, rol, nivel_acceso, pin_seguridad, to } = await request.json();

    if (!nombre || !email || !pin_seguridad) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    const from = process.env.NODE_ENV === 'production'
      ? 'sistema@tudominio.com'   // ← cambia por tu dominio verificado
      : 'onboarding@resend.dev';

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
      console.error('Error de Resend:', error);
      return NextResponse.json(
        { error: `Error de Resend: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en API send-email:', error);
    return NextResponse.json(
      { error: `Error interno: ${error.message}` },
      { status: 500 }
    );
  }
}