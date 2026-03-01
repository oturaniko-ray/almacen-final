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

// POST /api/telegram/preview
// Body: { texto: string, tipo: 'empleado'|'flota', destinatario_id?: string }
// Devuelve el texto con variables reemplazadas usando datos reales del destinatario
export async function POST(request: NextRequest) {
    try {
        await requireAdminAuth();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const { texto, tipo, destinatario_id } = await request.json();
    if (!texto) return NextResponse.json({ error: 'Falta texto' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    let datos: Record<string, string> = {
        nombre: 'Juan García',
        fecha: new Date().toLocaleDateString('es-ES'),
        hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        telefono: '+34 600 000 000',
        documento: '12345678A',
        pin: '****',
        flota: 'Flota Norte',
        turno: 'Mañana',
    };

    // Si hay destinatario específico, usar sus datos reales
    if (destinatario_id) {
        if (tipo === 'empleado') {
            const { data } = await (supabase as any)
                .from('empleados')
                .select('nombre, telefono, documento_id')
                .eq('id', destinatario_id)
                .single();
            if (data) {
                datos = { ...datos, nombre: data.nombre, telefono: data.telefono || '', documento: data.documento_id || '' };
            }
        } else if (tipo === 'flota') {
            const { data } = await (supabase as any)
                .from('flota_perfil')
                .select('nombre_completo, telefono, documento_id, nombre_flota')
                .eq('id', destinatario_id)
                .single();
            if (data) {
                datos = { ...datos, nombre: data.nombre_completo, telefono: data.telefono || '', flota: data.nombre_flota || '' };
            }
        }
    }

    const preview = texto
        .replace(/\{nombre\}/g, datos.nombre)
        .replace(/\{fecha\}/g, datos.fecha)
        .replace(/\{hora\}/g, datos.hora)
        .replace(/\{telefono\}/g, datos.telefono)
        .replace(/\{documento\}/g, datos.documento)
        .replace(/\{pin\}/g, datos.pin)
        .replace(/\{flota\}/g, datos.flota)
        .replace(/\{turno\}/g, datos.turno);

    return NextResponse.json({ preview });
}
