import nodemailer from 'nodemailer';

// Verificar que estamos en el servidor
if (typeof window !== 'undefined') {
  throw new Error('Este módulo solo puede ejecutarse en el servidor');
}

// El resto de tu código permanece igual...
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

// Interfaces para los tipos de datos
interface EmpleadoData {
  nombre: string;
  documento_id: string;
  email: string;
  rol: string;
  nivel_acceso: number;
  pin_seguridad: string;
}

interface FlotaData {
  nombre_completo: string;
  documento_id: string;
  email: string;
  nombre_flota: string;
  cant_choferes: number;
  cant_rutas: number;
  pin_secreto: string;
}

// Crear transporter de nodemailer con configuración IONOS
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ionos.es',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true para 465, false para 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false // Solo necesario en desarrollo
  }
});

// En emailService.ts, después de const transporter = ...
console.log('📧 ENVIANDO CON IONOS:', {
  host: process.env.SMTP_HOST,
  user: process.env.SMTP_USER,
  from: process.env.EMAIL_FROM
});

// Verificar conexión al iniciar
if (process.env.NODE_ENV !== 'production') {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Error en configuración de email:', error);
    } else {
      console.log('✅ Servidor de email listo para enviar mensajes');
    }
  });
}

// Generar HTML para email de empleado
const generarHtmlEmpleado = (datos: EmpleadoData): string => {
  return `
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
              <td><strong>${datos.rol.toUpperCase()}</strong></td>
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
};

// Generar HTML para email de flota
const generarHtmlFlota = (datos: FlotaData): string => {
  return `
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
};

// Función principal para enviar emails
export async function enviarEmail(
  tipo: 'empleado' | 'flota' | 'test',
  datos: any,
  to?: string
) {
  try {
    let destinatario = to || datos.email;
    
    if (!destinatario) {
      throw new Error('No se especificó destinatario');
    }

    let subject = '';
    let html = '';

    switch (tipo) {
      case 'empleado':
        subject = `🔐 Bienvenido ${datos.nombre} - Sistema Red Mundial`;
        html = generarHtmlEmpleado(datos as EmpleadoData);
        break;
      
      case 'flota':
        subject = `🚛 Perfil de Flota - ${datos.nombre_completo}`;
        html = generarHtmlFlota(datos as FlotaData);
        break;
      
      case 'test':
        subject = '📧 Prueba de Configuración';
        html = '<h1>Correo de prueba</h1><p>La configuración SMTP funciona correctamente.</p>';
        break;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Sistema <admin@redmundialenvios.online>',
      to: destinatario,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
      data: info
    };

  } catch (error: any) {
    console.error('❌ Error enviando email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}