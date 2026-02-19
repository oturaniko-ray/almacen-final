import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 segundos máximo

// Definir interfaces para los tipos de datos
interface Empleado {
  id: string;
  nombre: string;
  telefono: string | null;
}

interface Flota {
  id: string;
  nombre_completo: string;
  telefono: string | null;
}

interface Destinatario {
  id: string;
  nombre?: string;
  nombre_completo?: string;
  telefono: string | null;
}

// Interfaz para la configuración de destinatarios
interface ConfigDestinatarios {
  roles?: number[];
  empleados?: string[];
  flota?: string[];
}

// Interfaz para las programaciones
interface Programacion {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  fecha_programada: string;
  fecha_fin: string | null;
  destinatarios: ConfigDestinatarios;
  mensaje_template: string;
  estado: string;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

// Función auxiliar para obtener destinatarios
async function obtenerDestinatarios(config: ConfigDestinatarios): Promise<Destinatario[]> {
  const destinatarios: Destinatario[] = [];
  
  if (config.roles && config.roles.length > 0) {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre, telefono')
      .in('nivel_acceso', config.roles);
    
    if (data) {
      const empleados = data as Empleado[];
      destinatarios.push(...empleados);
    }
  }
  
  if (config.empleados && config.empleados.length > 0) {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre, telefono')
      .in('id', config.empleados);
    
    if (data) {
      const empleados = data as Empleado[];
      destinatarios.push(...empleados);
    }
  }
  
  if (config.flota && config.flota.length > 0) {
    const { data } = await supabase
      .from('flota_perfil')
      .select('id, nombre_completo, telefono')
      .in('id', config.flota);
    
    if (data) {
      const flota = data as Flota[];
      const flotaMapeada: Destinatario[] = flota.map(f => ({
        id: f.id,
        nombre_completo: f.nombre_completo,
        telefono: f.telefono
      }));
      destinatarios.push(...flotaMapeada);
    }
  }
  
  return destinatarios;
}

// Función para procesar plantillas
function procesarTemplate(template: string, destinatario: Destinatario) {
  return template
    .replace(/{{nombre}}/g, destinatario.nombre || destinatario.nombre_completo || '')
    .replace(/{{fecha}}/g, new Date().toLocaleDateString())
    .replace(/{{hora}}/g, new Date().toLocaleTimeString());
}

// ÚNICA función GET - Esta maneja las peticiones del CRON
export async function GET(request: NextRequest) {
  // Verificar el secreto (solo si configuraste CRON_SECRET)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const ahora = new Date().toISOString();
    
    // Buscar programaciones pendientes cuya fecha ya llegó
    const { data: programacionesData, error } = await supabase
      .from('programaciones')
      .select('*')
      .eq('estado', 'pendiente')
      .lte('fecha_programada', ahora);

    if (error) throw error;

    // Tipar los datos de programaciones
    const programaciones = programacionesData as Programacion[];

    if (!programaciones || programaciones.length === 0) {
      return NextResponse.json({ 
        success: true, 
        procesadas: 0,
        message: 'No hay programaciones pendientes' 
      });
    }

    const resultados = [];

    for (const prog of programaciones) {
      // Determinar destinatarios según configuración
      const destinatarios = await obtenerDestinatarios(prog.destinatarios);
      
      // Enviar a cada destinatario
      for (const dest of destinatarios) {
        if (!dest.telefono) continue; // Saltar si no tiene teléfono
        
        const mensaje = procesarTemplate(prog.mensaje_template, dest);
        
        // Llamar a nuestra API de WhatsApp
        const response = await fetch(`${process.env.APP_URL || 'https://almacen-final.vercel.app'}/api/send-whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: dest.telefono,
            message: mensaje,
            programacionId: prog.id
          }),
        });

        resultados.push({ 
          destinatario: dest.id, 
          success: response.ok 
        });
      }

      // ✅ SOLUCIÓN: Usar (supabase as any) para el update
      await (supabase as any)
        .from('programaciones')
        .update({ estado: 'enviado' })
        .eq('id', prog.id);
    }

    return NextResponse.json({ 
      success: true, 
      procesadas: programaciones.length,
      resultados 
    });

  } catch (error: any) {
    console.error('Error en CRON:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}