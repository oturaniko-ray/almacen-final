import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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
      subject = `🔐 Bienvenido ${datos.nombre} - Sistema Red Mundial`;
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .pin-box { background: #020617; color: #3b82f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; border-radius: 8px; margin: 20px 0; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            td { padding: 10px; border-bottom: 1px solid #ddd; }
            .label { font-weight: bold; width: 40%; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 ACCESO AL SISTEMA</h1>
              <p>RED MUNDIAL DE ENVÍOS</p>
            </div>
            <div class="content">
              <h2>Bienvenido, ${datos.nombre}</h2>
              <p>Se ha creado tu cuenta de acceso al sistema. A continuación encontrarás tus credenciales:</p>
              
              <table>
                <tr>
                  <td class="label">📋 Documento ID:</td>
                  <td><strong>${datos.documento_id}</strong></td>
                </tr>
                <tr>
                  <td class="label">📧 Correo:</td>
                  <td><strong>${datos.email}</strong></td>
                </tr>
                <tr>
                  <td class="label">👤 Rol:</td>
                  <td><strong>${datos.rol?.toUpperCase() || ''}</strong></td>
                </tr>
                <tr>
                  <td class="label">📊 Nivel de acceso:</td>
                  <td><strong>${datos.nivel_acceso}</strong></td>
                </tr>
              </table>
              
              <div class="pin-box">
                PIN: ${datos.pin_seguridad}
              </div>
              
              <p><strong>📱 Instrucciones:</strong></p>
              <ul>
                <li>Visita: <strong>redmundialenvios.online</strong></li>
                <li>Selecciona "ACCESO PERSONAL"</li>
                <li>Ingresa tu documento o correo</li>
                <li>Usa el PIN proporcionado</li>
              </ul>
              
              <p>⚠️ Por seguridad, cambia tu PIN en tu primer acceso.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Red Mundial de Envíos - Todos los derechos reservados</p>
              <p>Este es un correo automático, por favor no responder.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (tipo === 'flota') {
      subject = `🚛 Perfil de Flota - ${datos.nombre_completo}`;
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .pin-box { background: #020617; color: #3b82f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; border-radius: 8px; margin: 20px 0; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            td { padding: 10px; border-bottom: 1px solid #ddd; }
            .label { font-weight: bold; width: 40%; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚛 ACCESO FLOTA</h1>
              <p>RED MUNDIAL DE ENVÍOS</p>
            </div>
            <div class="content">
              <h2>Bienvenido, ${datos.nombre_completo}</h2>
              <p>Se ha registrado tu perfil de flota en el sistema. Estos son tus datos:</p>
              
              <table>
                <tr>
                  <td class="label">📋 Documento ID:</td>
                  <td><strong>${datos.documento_id}</strong></td>
                </tr>
                <tr>
                  <td class="label">📧 Correo:</td>
                  <td><strong>${datos.email}</strong></td>
                </tr>
                <tr>
                  <td class="label">🏢 Flota:</td>
                  <td><strong>${datos.nombre_flota || 'No especificada'}</strong></td>
                </tr>
                <tr>
                  <td class="label">👥 Choferes:</td>
                  <td><strong>${datos.cant_choferes}</strong></td>
                </tr>
                <tr>
                  <td class="label">🛣️ Rutas:</td>
                  <td><strong>${datos.cant_rutas}</strong></td>
                </tr>
              </table>
              
              <div class="pin-box">
                PIN: ${datos.pin_secreto}
              </div>
              
              <p><strong>📱 Instrucciones:</strong></p>
              <ul>
                <li>Visita: <strong>redmundialenvios.online</strong></li>
                <li>Un supervisor registrará tu ingreso</li>
                <li>Presenta tu documento ID cuando te soliciten</li>
              </ul>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Red Mundial de Envíos - Todos los derechos reservados</p>
              <p>Este es un correo automático, por favor no responder.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Sistema <admin@redmundialenvios.online>',
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