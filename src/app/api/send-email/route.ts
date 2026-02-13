import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { BienvenidaEmpleado } from '@/emails/BienvenidaEmpleado';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { 
      nombre, 
      documento_id, 
      email, 
      rol, 
      nivel_acceso, 
      pin_seguridad,
      to 
    } = await request.json();

    // Validar que tengamos los datos mínimos
    if (!nombre || !email || !pin_seguridad) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // Configurar el remitente según el entorno
    const from = process.env.NODE_ENV === 'production'
      ? 'sistema@gestiontotal.com'   // ← CAMBIA ESTO POR TU DOMINIO VERIFICADO
      : 'onboarding@resend.dev';  // Para pruebas, Resend proporciona esta dirección

    const { data, error } = await resend.emails.send({
      from,
      to: to || email, // Si se especifica 'to' (para reenvío), usarlo; si no, el email del empleado
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
      console.error('Error al enviar email:', error);
      return NextResponse.json(
        { error: 'Error al enviar el correo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error en API send-email:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}