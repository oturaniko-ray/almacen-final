import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import BienvenidaEmpleado from '@/emails/BienvenidaEmpleado';
import BienvenidaFlota from '@/emails/BienvenidaFlota';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { tipo, to, ...data } = await request.json();

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Email de destinatario requerido' },
        { status: 400 }
      );
    }

    let subject = '';
    let reactComponent;

    // Seleccionar plantilla según el tipo
    if (tipo === 'empleado') {
      subject = `🎫 Bienvenido al Sistema - ${data.nombre}`;
      reactComponent = BienvenidaEmpleado({
        nombre: data.nombre,
        documento_id: data.documento_id,
        email: data.email,
        rol: data.rol,
        nivel_acceso: data.nivel_acceso,
        pin_seguridad: data.pin_seguridad,
      });
    } else if (tipo === 'flota') {
      subject = `🚛 Perfil de Flota Creado - ${data.nombre_completo}`;
      reactComponent = BienvenidaFlota({
        nombre_completo: data.nombre_completo,
        documento_id: data.documento_id,
        nombre_flota: data.nombre_flota,
        cant_choferes: data.cant_choferes,
        cant_rutas: data.cant_rutas,
        pin_secreto: data.pin_secreto,
        email: data.email,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipo de email no válido' },
        { status: 400 }
      );
    }

    const { data: emailData, error } = await resend.emails.send({
      from: 'Gestor de Acceso <seguridad@tuempresa.com>',
      to: [to],
      subject: subject,
      react: reactComponent,
    });

    if (error) {
      console.error('Error Resend:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: emailData,
      message: `Email enviado correctamente a ${to}`
    });

  } catch (error: any) {
    console.error('Error en API send-email:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}