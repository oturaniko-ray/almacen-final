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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Delay para no superar el límite de 30 msg/s de Telegram
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function enviarMensajeTelegram(chatId: string, texto: string): Promise<boolean> {
    try {
        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' }),
        });
        const data = await res.json();
        return data.ok === true;
    } catch {
        return false;
    }
}

// Reemplaza variables en el texto con los datos del destinatario
function resolverVariables(texto: string, datos: Record<string, string>): string {
    return texto
        .replace(/\{nombre\}/g, datos.nombre || '')
        .replace(/\{fecha\}/g, datos.fecha || new Date().toLocaleDateString('es-ES'))
        .replace(/\{hora\}/g, datos.hora || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
        .replace(/\{telefono\}/g, datos.telefono || '')
        .replace(/\{documento\}/g, datos.documento || '')
        .replace(/\{pin\}/g, datos.pin || '')
        .replace(/\{flota\}/g, datos.flota || '')
        .replace(/\{turno\}/g, datos.turno || '');
}

// ================================================================
// POST /api/telegram/send
// Body: { tipo: 'empleado'|'flota', alcance: 'todos'|'individual'|'etiqueta',
//         destinatario_id?: string, etiqueta?: string,
//         mensaje: string, plantilla_id?: string }
// ================================================================
export async function POST(request: NextRequest) {
    let user: any;
    try {
        user = await requireAdminAuth();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const nivel = Number(user.nivel_acceso);
    const body = await request.json();
    const { tipo, alcance, destinatario_id, etiqueta, mensaje, plantilla_id } = body;

    if (!tipo || !alcance || !mensaje) {
        return NextResponse.json({ error: 'Faltan campos requeridos: tipo, alcance, mensaje' }, { status: 400 });
    }

    // Validar nivel de acceso según el tipo de destinatario
    if (tipo === 'flota' && nivel < 5) {
        return NextResponse.json({ error: 'Nivel 5+ requerido para mensajes a flota' }, { status: 403 });
    }
    if (nivel < 4) {
        return NextResponse.json({ error: 'Nivel 4+ requerido' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const ahora = new Date().toISOString();

    // ── Obtener destinatarios ──
    let chatIds: { chat_id: string; datos: Record<string, string> }[] = [];

    if (tipo === 'empleado') {
        let query = (supabase as any)
            .from('telegram_usuarios')
            .select('chat_id, empleado_id, nombre, empleados(telefono, documento_id, pin_seguridad)')
            .eq('tipo', 'empleado')
            .eq('activo', true);

        if (alcance === 'individual' && destinatario_id) {
            query = query.eq('empleado_id', destinatario_id);
        }
        // etiqueta: por ahora reservado para futuros campos de turno/zona

        const { data: usuarios } = await query;
        chatIds = (usuarios || []).map((u: any) => ({
            chat_id: u.chat_id,
            datos: {
                nombre: u.nombre || '',
                telefono: u.empleados?.telefono || '',
                documento: u.empleados?.documento_id || '',
                pin: u.empleados?.pin_seguridad || '',
            },
        }));

    } else if (tipo === 'flota') {
        let query = (supabase as any)
            .from('telegram_usuarios')
            .select('chat_id, flota_id, nombre, flota_perfil(telefono, documento_id, pin_secreto, nombre_flota)')
            .eq('tipo', 'flota')
            .eq('activo', true);

        if (alcance === 'individual' && destinatario_id) {
            query = query.eq('flota_id', destinatario_id);
        }

        const { data: usuarios } = await query;
        chatIds = (usuarios || []).map((u: any) => ({
            chat_id: u.chat_id,
            datos: {
                nombre: u.nombre || '',
                telefono: u.flota_perfil?.telefono || '',
                documento: u.flota_perfil?.documento_id || '',
                pin: u.flota_perfil?.pin_secreto || '',
                flota: u.flota_perfil?.nombre_flota || '',
            },
        }));
    }

    if (!chatIds.length) {
        return NextResponse.json({ success: false, error: 'No hay destinatarios con Telegram vinculado' }, { status: 404 });
    }

    // ── Enviar mensajes ──
    let enviados = 0;
    let errores = 0;

    for (const dest of chatIds) {
        const textoFinal = resolverVariables(mensaje, {
            ...dest.datos,
            fecha: new Date().toLocaleDateString('es-ES'),
            hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        });
        const ok = await enviarMensajeTelegram(dest.chat_id, textoFinal);
        if (ok) enviados++; else errores++;
        if (chatIds.length > 1) await sleep(50); // 20 msg/s máximo
    }

    // ── Guardar en historial ──
    await (supabase as any)
        .from('telegram_mensajes')
        .insert({
            enviado_por: user.id,
            destinatario_tipo: alcance === 'individual' ? `individual_${tipo}` : `grupo_${tipo}`,
            destinatario_id: alcance === 'individual' ? destinatario_id : null,
            etiqueta: etiqueta || null,
            plantilla_id: plantilla_id || null,
            mensaje_final: mensaje,
            total_enviados: enviados,
            total_errores: errores,
            estado: errores === 0 ? 'enviado' : enviados === 0 ? 'error' : 'parcial',
        });

    return NextResponse.json({ success: true, enviados, errores, total: chatIds.length });
}
