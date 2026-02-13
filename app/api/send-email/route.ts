import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { BienvenidaEmpleado } from '../../../emails/BienvenidaEmpleado';

// Inicializar Resend solo si la API key está disponible, para evitar errores en compilación
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: Request) {
  try {
    // Verificar que resend esté configurado
    if (!resend) {
      console.error('RESEND_API_KEY no está configurada');
      return NextResponse.json(
        { error: 'Error de configuración del servidor de correo' },
        { status: 500 }
      );
    }

    const { 
      nombre, 
      documento_id, 
      email, 
      rol, 
      nivel_acceso, 
      pin_seguridad,
      to 
    } = await request.json();

    if (!nombre || !email || !pin_seguridad) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    const from = process.env.NODE_ENV === 'production'
      ? 'sistema@tudominio.com'   // ← CAMBIA POR TU DOMINIO VERIFICADO
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