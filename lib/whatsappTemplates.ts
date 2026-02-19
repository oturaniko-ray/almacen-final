// lib/whatsappTemplates.ts

// Función para enviar WhatsApp (similar a enviarEmail)
export async function enviarWhatsApp(telefono: string, mensaje: string) {
  try {
    const response = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: telefono, message: mensaje }),
    });
    return await response.json();
  } catch (error: any) {
    console.error('Error enviando WhatsApp:', error);
    return { success: false, error: error.message };
  }
}

// Plantillas de mensajes
export const templates = {
  bienvenidaEmpleado: (nombre: string, pin: string) => 
    `Hola ${nombre}, ¡bienvenido al sistema! Tu PIN de acceso es: ${pin}. Puedes ingresar en: https://almacen-final.vercel.app/`,

  bienvenidaFlota: (nombre: string, pin: string) => 
    `Hola ${nombre}, se ha registrado tu perfil de flota. Tu PIN es: ${pin}. Preséntalo con tu documento cuando llegues al almacén.`,
};