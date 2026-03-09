import nodemailer from 'nodemailer';

// Configurar transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ionos.es',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

export async function enviarReportePorEmail(
  destinatarios: string[],
  asunto: string,
  buffer: Buffer,
  nombreArchivo: string
) {
  console.log(`📧 Enviando reporte a: ${destinatarios.join(', ')}`);
  
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'reportes@redmundialenvios.online',
    to: destinatarios.join(', '),
    subject: asunto,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563eb;">📊 Reporte Automático</h2>
        <p>Adjunto encontrarás el reporte solicitado.</p>
        <p><strong>Fecha de generación:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <p><strong>Archivo:</strong> ${nombreArchivo}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Este es un envío automático del sistema.</p>
      </div>
    `,
    attachments: [{
      filename: nombreArchivo,
      content: buffer,
    }],
  });

  console.log(`✅ Email enviado: ${info.messageId}`);
  return info;
}