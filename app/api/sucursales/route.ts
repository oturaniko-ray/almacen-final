import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
}

// GET /api/sucursales — listar todas (o activas con ?activas=true)
// POST /api/sucursales — crear sucursal
export async function GET(req: NextRequest) {
    const supabase = getAdminClient();
    const soloActivas = req.nextUrl.searchParams.get('activas') === 'true';

    let query = supabase
        .from('sucursales')
        .select('*')
        .order('codigo', { ascending: true });

    if (soloActivas) query = query.eq('activa', true);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    const supabase = getAdminClient();
    const body = await req.json();

    const { data, error } = await supabase
        .from('sucursales')
        .insert([body])
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Crear registro de correlativo para la nueva sucursal
    await supabase
        .from('correlativo')
        .insert([{ correlativo_personal: 0, correlativo_flota: 0, sucursal_codigo: data.codigo }]);

    return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
    const supabase = getAdminClient();
    const body = await req.json();
    const { codigo, ...campos } = body;

    if (!codigo) return NextResponse.json({ error: 'Falta codigo' }, { status: 400 });

    const { data, error } = await supabase
        .from('sucursales')
        .update({ ...campos, updated_at: new Date().toISOString() })
        .eq('codigo', codigo)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
