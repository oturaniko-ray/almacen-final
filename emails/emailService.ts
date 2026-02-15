import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Interfaces para los datos
export interface EmailEmpleadoData {
  nombre: string;
  documento_id: string;
  email: string;
  rol: string;
  nivel_acceso: number;
  pin_seguridad: string;
}

export interface EmailFlotaData {
  nombre_completo: string;
  documento_id: string;
  email: string;
  nombre_flota: string;
  cant_choferes: number;
  cant_rutas: number;
  pin_secreto: string;
}

// Función principal para enviar emails
export async function enviarEmail(tipo: 'empleado' | 'flota', data: any, to?: string) {
  try {
    const destinatario = to || data.email || data.email_conductor;
    
    if (!destinatario) {
      throw new Error('No se ha proporcionado email de destino');
    }

    console.log(`📧 Enviando email tipo ${tipo} a:`, destinatario);

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tipo,
        to: destinatario,
        ...data,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error al enviar email');
    }

    // Registrar envío exitoso en la base de datos
    await supabase.from('email_logs').insert([{
      tipo,
      destinatario,
      documento_id: data.documento_id,
      fecha_envio: new Date().toISOString(),
      estado: 'enviado',
      metadata: {
        nombre: data.nombre || data.nombre_completo,
        email: destinatario
      }
    }]);

    console.log(`✅ Email enviado correctamente a ${destinatario}`);
    return { success: true, data: result.data };

  } catch (error: any) {
    console.error('❌ Error enviando email:', error);

    // Registrar error en la base de datos
    await supabase.from('email_logs').insert([{
      tipo,
      destinatario: to || data.email || data.email_conductor,
      documento_id: data.documento_id,
      fecha_envio: new Date().toISOString(),
      estado: 'error',
      error: error.message,
      metadata: {
        nombre: data.nombre || data.nombre_completo
      }
    }]);

    return { success: false, error: error.message };
  }
}

// Funciones específicas para cada tipo (mantener compatibilidad)
export async function enviarCorreoEmpleado(empleado: any, to?: string) {
  return enviarEmail('empleado', {
    nombre: empleado.nombre,
    documento_id: empleado.documento_id,
    email: empleado.email,
    rol: empleado.rol,
    nivel_acceso: empleado.nivel_acceso,
    pin_seguridad: empleado.pin_seguridad,
  }, to);
}

export async function enviarCorreoFlota(perfil: any, to?: string) {
  return enviarEmail('flota', {
    nombre_completo: perfil.nombre_completo,
    documento_id: perfil.documento_id,
    email: perfil.email,
    nombre_flota: perfil.nombre_flota || '',
    cant_choferes: perfil.cant_choferes || 1,
    cant_rutas: perfil.cant_rutas || 0,
    pin_secreto: perfil.pin_secreto,
  }, to);
}