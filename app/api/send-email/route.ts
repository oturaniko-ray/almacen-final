export const runtime = 'nodejs'; // Fuerza el uso de Node.js runtime
export const dynamic = 'force-dynamic'; // Evita el caché estático

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Función para sanitizar texto (eliminar caracteres problemáticos)
const sanitizarTexto = (texto: string | null | undefined): string => {
  if (!texto) return '';
  return texto
    .replace(/[<>]/g, '') // Eliminar < y > que podrían interpretarse como HTML
    .replace(/&/g, '&amp;') // Escapar & (aunque el servidor SMTP puede no necesitarlo, es buena práctica)
    .replace(/"/g, '&quot;') // Escapar comillas dobles
    .replace(/'/g, '&#039;') // Escapar comillas simples
    .trim();
};

// Función para escapar HTML para el cuerpo del correo
const escaparHTML = (texto: string | null | undefined): string => {
  if (!texto) return '';
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export async function POST(request: Request) {
  // Verificar método
  if (request.method !== 'POST') {
    return NextResponse.json(
      { success: false, error: 'Método no permitido' },
      { status: 405 }
    );
  }

  try {
    const body = await request.json();
    console.log('📨 Recibida solicitud de email:', { tipo: body.tipo, to: body.to });

    const { tipo, datos, to } = body;

    // Validar datos mínimos
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

    // Validar que el destinatario tenga un formato de email válido
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(destinatario)) {
      return NextResponse.json(
        { success: false, error: `El email del destinatario no es válido: ${destinatario}` },
        { status: 400 }
      );
    }

    // Sanitizar datos antes de usarlos
    const datosSanitizados = {
      ...datos,
      nombre: sanitizarTexto(datos.nombre),
      nombre_completo: sanitizarTexto(datos.nombre_completo),
      documento_id: sanitizarTexto(datos.documento_id),
      email: destinatario, // El email ya está validado
      rol: sanitizarTexto(datos.rol),
      nombre_flota: sanitizarTexto(datos.nombre_flota),
      observacion: sanitizarTexto(datos.observacion),
    };

    // Crear transporter (la misma configuración)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ionos.es',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      // Añadir timeout para evitar bloqueos
      connectionTimeout: 10000, // 10 segundos
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    // Verificar conexión antes de enviar
    await transporter.verify();

    let subject = '';
    let html = '';

    // Generar HTML según el tipo, escapando correctamente
    if (tipo === 'empleado') {
      subject = `🔐 Bienvenido ${datosSanitizados.nombre} - Sistema Red Mundial`;
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
              <h2>Bienvenido, ${escaparHTML(datosSanitizados.nombre)}</h2>
              <p>Se ha creado tu cuenta de acceso al sistema. A continuación encontrarás tus credenciales:</p>
              
              <table>
                <tr>
                  <td class="label">📋 Documento ID:</td>
                  <td><strong>${escaparHTML(datosSanitizados.documento_id)}</strong></td>
                </tr>
                <tr>
                  <td class="label">📧 Correo:</td>
                  <td><strong>${escaparHTML(datosSanitizados.email)}</strong></td>
                </tr>
                <tr>
                  <td class="label">👤 Rol:</td>
                  <td><strong>${escaparHTML(datosSanitizados.rol?.toUpperCase() || '')}</strong></td>
                </tr>
                <tr>
                  <td class="label">📊 Nivel de acceso:</td>
                  <td><strong>${datosSanitizados.nivel_acceso}</strong></td>
                </tr>
              </table>
              
              <div class="pin-box">
                PIN: ${escaparHTML(datosSanitizados.pin_seguridad)}
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
      subject = `🚛 Perfil de Flota - ${datosSanitizados.nombre_completo}`;
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
              <h2>Bienvenido, ${escaparHTML(datosSanitizados.nombre_completo)}</h2>
              <p>Se ha registrado tu perfil de flota en el sistema. Estos son tus datos:</p>
              
              <table>
                <tr>
                  <td class="label">📋 Documento ID:</td>
                  <td><strong>${escaparHTML(datosSanitizados.documento_id)}</strong></td>
                </tr>
                <tr>
                  <td class="label">📧 Correo:</td>
                  <td><strong>${escaparHTML(datosSanitizados.email)}</strong></td>
                </tr>
                <tr>
                  <td class="label">🏢 Flota:</td>
                  <td><strong>${escaparHTML(datosSanitizados.nombre_flota || 'No especificada')}</strong></td>
                </tr>
                <tr>
                  <td class="label">👥 Choferes:</td>
                  <td><strong>${datosSanitizados.cant_choferes}</strong></td>
                </tr>
                <tr>
                  <td class="label">🛣️ Rutas:</td>
                  <td><strong>${datosSanitizados.cant_rutas}</strong></td>
                </tr>
              </table>
              
              <div class="pin-box">
                PIN: ${escaparHTML(datosSanitizados.pin_secreto)}
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
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipo de email no válido' },
        { status: 400 }
      );
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Sistema <admin@redmundialenvios.online>',
      to: destinatario,
      subject,
      html,
      // Añadir cabeceras para mejorar la entrega
      headers: {
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'X-Mailer': 'RedMundial Sistema',
      },
    };

    console.log('📧 Enviando correo a:', destinatario);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Correo enviado:', info.messageId);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: `Email enviado correctamente a ${destinatario}`
    });

  } catch (error: any) {
    console.error('❌ Error detallado en API send-email:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    // Devolver un error más descriptivo
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor',
        code: error.code,
        command: error.command,
        response: error.response,
      },
      { status: 500 }
    );
  }
}