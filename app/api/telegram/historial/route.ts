import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authApi';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
    );
}

// GET /api/telegram/historial?tipo=empleado&page=1&limit=20
export async function GET(request: NextRequest) {
    let user: any;
    try {
        user = await requireAdminAuth();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const nivel = Number(user.nivel_acceso);
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'empleado';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (tipo === 'flota' && nivel < 5) {
        return NextResponse.json({ error: 'Nivel 5+ requerido para historial de flota' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const offset = (page - 1) * limit;

    // ✅ Filtro usando nombre correcto de columna: tipo_destinatario
    const tipoFiltro = tipo === 'flota'
        ? ['individual_flota', 'grupo_flota']
        : ['individual_empleado', 'grupo_empleado'];

    const { data, error, count } = await (supabase as any)
        .from('telegram_mensajes')
        .select(`
          id,
          tipo_destinatario,
          nombre,
          etiqueta,
          contenido,
          mensaje_final,
          enviados,
          errores,
          estado,
          plantilla_id,
          created_at,
          enviado_por_empleado:empleados!enviado_por(nombre)
        `, { count: 'exact' })
        // ✅ Columna correcta: tipo_destinatario
        .in('tipo_destinatario', tipoFiltro)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Normalizar respuesta para la UI (compat backwards)
    const normalizado = (data || []).map((m: any) => ({
        ...m,
        // Alias para compatibilidad con la UI existente
        destinatario_tipo: m.tipo_destinatario,
        mensaje_mostrar: m.mensaje_final || m.contenido || '',
        total_enviados: m.enviados,
        total_errores: m.errores,
    }));

    return NextResponse.json({ data: normalizado, total: count, page, limit });
}
