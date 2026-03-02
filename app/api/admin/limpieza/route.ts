import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '@/lib/authApi';

// ──────────────────────────────────────────────
// Lista blanca: únicas tablas limpiables
// ──────────────────────────────────────────────
const CONFIG_TABLAS: Record<string, {
    campoFecha: string;
    filtroExtra?: Record<string, string>;
    label: string;
}> = {
    jornadas: { campoFecha: 'fecha_inicio', label: 'Jornadas de empleados' },
    flota_accesos: { campoFecha: 'hora_llegada', label: 'Accesos de flota' },
    auditoria_flota: { campoFecha: 'fecha_proceso', label: 'Auditoría de flota' },
    telegram_mensajes: { campoFecha: 'created_at', label: 'Historial Telegram' },
    whatsapp_mensajes: { campoFecha: 'created_at', label: 'Historial WhatsApp' },
    programaciones: { campoFecha: 'updated_at', label: 'Programaciones ejecutadas', filtroExtra: { estado: 'ejecutado' } },
};

// Seguridad: la fecha tope no puede ser más reciente que 180 días atrás
function esAntigua(hasta: string): boolean {
    const limite = new Date();
    limite.setDate(limite.getDate() - 180);
    return new Date(hasta) <= limite;
}

export async function POST(request: NextRequest) {
    // createClient DENTRO del handler — evita evaluación en build time
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let auth: any;
    try {
        auth = await requireAdminAuth();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 });
    }

    if (Number(auth.nivel_acceso) < 8) {
        return NextResponse.json({ error: 'Nivel 8 requerido para limpieza de datos' }, { status: 403 });
    }

    let body: any;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const { tabla, accion, desde, hasta, dias } = body;

    const cfg = CONFIG_TABLAS[tabla];
    if (!cfg) return NextResponse.json({ error: `Tabla no permitida: ${tabla}` }, { status: 400 });

    // Calcular fecha tope
    let fechaHasta: string;
    if (dias) {
        const d = new Date();
        d.setDate(d.getDate() - Number(dias));
        fechaHasta = d.toISOString();
    } else if (hasta) {
        fechaHasta = new Date(hasta).toISOString();
    } else {
        return NextResponse.json({ error: 'Se requiere dias o hasta' }, { status: 400 });
    }

    if (!esAntigua(fechaHasta)) {
        return NextResponse.json({
            error: 'Por seguridad, la fecha de limpieza debe ser al menos 180 días en el pasado.'
        }, { status: 400 });
    }

    const fechaDesde: string | null = desde ? new Date(desde).toISOString() : null;

    if (accion === 'preview') {
        let q = (supabase as any).from(tabla).select('*', { count: 'exact', head: true });
        if (fechaDesde) q = q.gte(cfg.campoFecha, fechaDesde);
        q = q.lte(cfg.campoFecha, fechaHasta);
        if (cfg.filtroExtra) {
            for (const [k, v] of Object.entries(cfg.filtroExtra)) q = q.eq(k, v);
        }
        const { count, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ count: count ?? 0, tabla, label: cfg.label });
    }

    if (accion === 'delete') {
        let q = (supabase as any).from(tabla).delete();
        if (fechaDesde) q = q.gte(cfg.campoFecha, fechaDesde);
        q = q.lte(cfg.campoFecha, fechaHasta);
        if (cfg.filtroExtra) {
            for (const [k, v] of Object.entries(cfg.filtroExtra)) q = q.eq(k, v);
        }
        const { error, count } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        console.log(`🧹 Limpieza: nivel ${auth.nivel_acceso} eliminó de ${tabla} hasta ${fechaHasta}`);
        return NextResponse.json({ success: true, eliminados: count ?? 0, tabla, label: cfg.label });
    }

    return NextResponse.json({ error: 'accion debe ser preview o delete' }, { status: 400 });
}
