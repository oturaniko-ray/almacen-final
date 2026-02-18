export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET() {
  const resultados: any = {
    paso1_conexion: null,
    paso2_envio: null,
    configuracion: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      from: process.env.EMAIL_FROM,
    }
  };

  try {
    // Paso 1: Probar conexión SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();
    resultados.paso1_conexion = { success: true, message: 'Conexión SMTP exitosa' };

    // Paso 2: Enviar correo de prueba con formato SIMPLE
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM, // Ahora debería ser solo el email
      to: process.env.SMTP_USER,
      subject: 'Prueba desde Vercel',
      text: 'Correo de prueba desde Vercel',
      html: '<p>Correo de prueba desde <b>Vercel</b></p>',
    });

    resultados.paso2_envio = { 
      success: true, 
      messageId: info.messageId,
      message: 'Correo enviado correctamente'
    };

  } catch (error: any) {
    console.error('Error completo:', error);
    
    if (!resultados.paso1_conexion) {
      resultados.paso1_conexion = { 
        success: false, 
        error: error.message,
        code: error.code 
      };
    } else {
      resultados.paso2_envio = { 
        success: false, 
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response
      };
    }
  }

  return NextResponse.json(resultados);
}