import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Interfaz para los datos de programación
interface ProgramacionData {
  tipo: string;
  titulo: string;
  descripcion?: string;
  fecha_programada: string;
  fecha_fin?: string;
  destinatarios: any;
  mensaje_template: string;
  estado?: string;
  creado_por?: string;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { tipo, titulo, fecha_programada, destinatarios, mensaje_template, descripcion, fecha_fin } = data;

    // Validar datos requeridos
    if (!tipo || !titulo || !fecha_programada || !destinatarios || !mensaje_template) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // Validar que destinatarios tenga al menos una opción
    const tieneDestinatarios = 
      (destinatarios.roles && destinatarios.roles.length > 0) ||
      (destinatarios.empleados && destinatarios.empleados.length > 0) ||
      (destinatarios.flota && destinatarios.flota.length > 0);

    if (!tieneDestinatarios) {
      return NextResponse.json(
        { success: false, error: 'Debe especificar al menos un destinatario' },
        { status: 400 }
      );
    }

    // Preparar datos para insertar
    const insertData: ProgramacionData = {
      tipo,
      titulo,
      fecha_programada,
      destinatarios,
      mensaje_template,
      estado: 'pendiente',
    };

    if (descripcion) insertData.descripcion = descripcion;
    if (fecha_fin) insertData.fecha_fin = fecha_fin;
    
    // TODO: Obtener el ID del usuario actual de la sesión
    // insertData.creado_por = usuarioId;

    // ✅ SOLUCIÓN: Usar (supabase as any) para el insert
    const { data: programacion, error } = await (supabase as any)
      .from('programaciones')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      data: programacion,
      message: 'Programación creada exitosamente'
    });

  } catch (error: any) {
    console.error('Error creando programación:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al crear programación' },
      { status: 500 }
    );
  }
}

// GET para listar programaciones
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const estado = searchParams.get('estado');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const offset = (page - 1) * limit;

    // Construir query
    let query = (supabase as any)
      .from('programaciones')
      .select('*', { count: 'exact' });

    if (tipo) query = query.eq('tipo', tipo);
    if (desde) query = query.gte('fecha_programada', desde);
    if (hasta) query = query.lte('fecha_programada', hasta);
    if (estado) query = query.eq('estado', estado);

    // Ordenar y paginar
    query = query
      .order('fecha_programada', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo programaciones:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener programaciones' },
      { status: 500 }
    );
  }
}

// DELETE para cancelar una programación
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere ID de programación' },
        { status: 400 }
      );
    }

    // ✅ SOLUCIÓN: Usar (supabase as any) para el delete
    const { error } = await (supabase as any)
      .from('programaciones')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Programación eliminada correctamente' 
    });

  } catch (error: any) {
    console.error('Error eliminando programación:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al eliminar programación' },
      { status: 500 }
    );
  }
}

// PATCH para actualizar una programación
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const updates = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere ID de programación' },
        { status: 400 }
      );
    }

    // No permitir actualizar ciertos campos
    delete updates.id;
    delete updates.created_at;
    delete updates.updated_at;

    // ✅ SOLUCIÓN: Usar (supabase as any) para el update
    const { data, error } = await (supabase as any)
      .from('programaciones')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Programación actualizada correctamente' 
    });

  } catch (error: any) {
    console.error('Error actualizando programación:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al actualizar programación' },
      { status: 500 }
    );
  }
}