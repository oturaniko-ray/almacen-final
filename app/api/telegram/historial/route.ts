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

    // Validar acceso según tipo
    if (tipo === 'flota' && nivel < 5) {
        return NextResponse.json({ error: 'Nivel 5+ requerido para historial de flota' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const offset = (page - 1) * limit;

    // Filtrar por tipo de destinatario
    const tipoFiltro = tipo === 'flota'
        ? ['individual_flota', 'grupo_flota']
        : ['individual_empleado', 'grupo_empleado'];

    const { data, error, count } = await (supabase as any)
        .from('telegram_mensajes')
        .select(`
      id, destinatario_tipo, etiqueta, mensaje_final,
      total_enviados, total_errores, estado, created_at,
      enviado_por_empleado:empleados!enviado_por(nombre)
    `, { count: 'exact' })
        .in('destinatario_tipo', tipoFiltro)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data, total: count, page, limit });
}
