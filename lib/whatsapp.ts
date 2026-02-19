// lib/whatsapp.ts
export const abrirWhatsAppWeb = (telefono: string | null | undefined) => {
  if (!telefono) {
    alert('El número de teléfono no está registrado');
    return;
  }

  // Limpiar el número (eliminar todo excepto dígitos)
  const numeroLimpio = telefono.replace(/[^0-9]/g, '');
  
  if (numeroLimpio.length < 10) {
    alert('Número de teléfono inválido');
    return;
  }

  // Abrir WhatsApp Web en una nueva pestaña
  window.open(`https://wa.me/${numeroLimpio}`, '_blank');
};