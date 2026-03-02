import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
}

// GET /api/sucursales/detectar?lat=X&lon=Y
// Devuelve la sucursal más cercana dentro de su radio, o null si ninguna coincide
export async function GET(req: NextRequest) {
    const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '');
    const lon = parseFloat(req.nextUrl.searchParams.get('lon') || '');

    if (isNaN(lat) || isNaN(lon)) {
        return NextResponse.json({ error: 'Parámetros lat y lon requeridos' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Usa la función SQL detectar_sucursal para máxima eficiencia
    const { data: codigoData, error: fnError } = await supabase
        .rpc('detectar_sucursal', { p_lat: lat, p_lon: lon });

    if (fnError) {
        return NextResponse.json({ error: fnError.message }, { status: 500 });
    }

    if (!codigoData) {
        // No hay sucursal en rango — devuelve lista para selector manual
        const { data: todas } = await supabase
            .from('sucursales')
            .select('codigo, nombre, provincia, lat, lon')
            .eq('activa', true)
            .order('codigo');
        return NextResponse.json({ deteccion: null, sucursales: todas });
    }

    // Devuelve la sucursal detectada con todos sus datos
    const { data: sucursal } = await supabase
        .from('sucursales')
        .select('*')
        .eq('codigo', codigoData)
        .single();

    return NextResponse.json({ deteccion: sucursal, sucursales: null });
}
