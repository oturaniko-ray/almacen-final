import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import BienvenidaEmpleado from '../../../emails/BienvenidaEmpleado';
import BienvenidaFlota from '../../../emails/BienvenidaFlota';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Error de configuración: falta API key' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { tipo } = body; // 'empleado' o 'flota'

    // Siempre usamos onboarding@resend.dev (no requiere verificación)
    const from = 'onboarding@resend.dev';

    let reactComponent;
    let subject;
    let to;

    if (tipo === 'flota') {
      const { nombre_completo, documento_id, nombre_flota, cant_choferes, cant_rutas, pin_secreto, email, to: toOverride } = body;
      if (!nombre_completo || !pin_secreto || !email) {
        return NextResponse.json(
          { error: 'Faltan datos requeridos para flota (email obligatorio)' },
          { status: 400 }
        );
      }
      reactComponent = BienvenidaFlota({
        nombre_completo,
        documento_id,
        nombre_flota,
        cant_choferes,
        cant_rutas,
        pin_secreto,
        email, // ← AGREGADO
      });
      subject = 'Bienvenido al Sistema de Flota - Credenciales de Acceso';
      to = toOverride || email;
    } else {
      // Empleado
      const { nombre, documento_id, email, rol, nivel_acceso, pin_seguridad, to: toOverride } = body;
      if (!nombre || !email || !pin_seguridad) {
        return NextResponse.json(
          { error: 'Faltan datos requeridos para empleado' },
          { status: 400 }
        );
      }
      reactComponent = BienvenidaEmpleado({
        nombre,
        documento_id,
        email,
        rol,
        nivel_acceso,
        pin_seguridad,
      });
      subject = 'Bienvenido al Sistema - Credenciales de Acceso';
      to = toOverride || email;
    }

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      react: reactComponent,
    });

    if (error) {
      console.error('❌ Error de Resend:', error);
      return NextResponse.json(
        { error: `Error de Resend: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Error en API send-email:', error);
    return NextResponse.json(
      { error: `Error interno: ${error.message}` },
      { status: 500 }
    );
  }
}