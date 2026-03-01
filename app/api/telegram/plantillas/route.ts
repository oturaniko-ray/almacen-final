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

// GET  /api/telegram/plantillas?tipo=empleado&categoria=horario
// POST /api/telegram/plantillas   (crear)
// PUT  /api/telegram/plantillas   (editar, body incluye id)
// DELETE /api/telegram/plantillas?id=xxx (desactivar)

export async function GET(request: NextRequest) {
    try {
        await requireAdminAuth();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const categoria = searchParams.get('categoria');

    let query = (supabase as any)
        .from('telegram_plantillas')
        .select('*')
        .eq('activo', true)
        .order('nombre');

    if (tipo) query = query.or(`tipo.eq.${tipo},tipo.eq.ambos`);
    if (categoria) query = query.eq('categoria', categoria);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
    let user: any;
    try {
        user = await requireAdminAuth();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 });
    }

    if (Number(user.nivel_acceso) < 6) {
        return NextResponse.json({ error: 'Nivel 6+ requerido para gestionar plantillas' }, { status: 403 });
    }

    const body = await request.json();
    const { nombre, categoria, tipo, contenido, variables } = body;

    if (!nombre || !contenido || !tipo) {
        return NextResponse.json({ error: 'Faltan campos: nombre, contenido, tipo' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await (supabase as any)
        .from('telegram_plantillas')
        .insert({ nombre, categoria, tipo, contenido, variables, activo: true })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
}

export async function PUT(request: NextRequest) {
    let user: any;
    try {
        user = await requireAdminAuth();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 });
    }

    if (Number(user.nivel_acceso) < 6) {
        return NextResponse.json({ error: 'Nivel 6+ requerido para gestionar plantillas' }, { status: 403 });
    }

    const body = await request.json();
    const { id, nombre, categoria, tipo, contenido, variables } = body;
    if (!id) return NextResponse.json({ error: 'Falta id de plantilla' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await (supabase as any)
        .from('telegram_plantillas')
        .update({ nombre, categoria, tipo, contenido, variables, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
    let user: any;
    try {
        user = await requireAdminAuth();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 });
    }

    if (Number(user.nivel_acceso) < 6) {
        return NextResponse.json({ error: 'Nivel 6+ requerido para gestionar plantillas' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await (supabase as any)
        .from('telegram_plantillas')
        .update({ activo: false })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
