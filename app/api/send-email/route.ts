export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import BienvenidaEmpleado from '@/emails/BienvenidaEmpleado';
import BienvenidaFlota from '@/emails/BienvenidaFlota';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ionos.es',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, datos, to } = body;

    if (!tipo || !datos) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    const destinatario = to || datos.email;
    if (!destinatario) {
      return NextResponse.json(
        { success: false, error: 'No se especificó destinatario' },
        { status: 400 }
      );
    }

    let subject = '';
    let html = '';

    if (tipo === 'empleado') {
      subject = `🎫 Bienvenido al Sistema - ${datos.nombre}`;
      
      // Usar la plantilla de React Email
      const emailTemplate = BienvenidaEmpleado({
        nombre: datos.nombre,
        documento_id: datos.documento_id,
        email: datos.email,
        rol: datos.rol,
        nivel_acceso: datos.nivel_acceso,
        pin_seguridad: datos.pin_seguridad,
      });
      
      html = render(emailTemplate);

    } else if (tipo === 'flota') {
      subject = `🚛 Perfil de Flota Creado - ${datos.nombre_completo}`;
      
      // Usar la plantilla de React Email
      const emailTemplate = BienvenidaFlota({
        nombre_completo: datos.nombre_completo,
        documento_id: datos.documento_id,
        nombre_flota: datos.nombre_flota,
        cant_choferes: datos.cant_choferes,
        cant_rutas: datos.cant_rutas,
        pin_secreto: datos.pin_secreto,
        email: datos.email,
      });
      
      html = render(emailTemplate);
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'admin@redmundialenvios.online',
      to: destinatario,
      subject,
      html,
    });

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId,
      message: `Email enviado correctamente a ${destinatario}`
    });

  } catch (error: any) {
    console.error('Error enviando email:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}