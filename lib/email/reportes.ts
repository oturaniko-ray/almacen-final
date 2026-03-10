import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

// ✅ CORREGIDO: Usamos el tipo exacto de nodemailer
import type { Attachment as NodemailerAttachment } from 'nodemailer/lib/mailer';

export async function enviarReportePorEmail(
  to: string | string[],
  subject: string,
  html: string,
  attachments?: NodemailerAttachment[]
) {
  // Configurar transporte
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Crear el objeto de opciones
  const mailOptions: SendMailOptions = {
    from: process.env.SMTP_FROM,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  };

  // ✅ CORREGIDO: Asignamos attachments directamente si existen
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  try {
    // Enviar correo
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Error enviando correo:', error);
    throw error;
  }
}