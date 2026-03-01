'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/apiClient';

interface MensajeHistorial {
    id: string;
    destinatario_tipo: string;
    etiqueta: string | null;
    mensaje_final: string;
    total_enviados: number;
    total_errores: number;
    estado: string;
    created_at: string;
    enviado_por_empleado: { nombre: string } | null;
}

const ESTADO_COLORS: Record<string, string> = {
    enviado: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    parcial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const TIPO_LABELS: Record<string, string> = {
    individual_empleado: '🎯 Individual',
    grupo_empleado: '👥 Todos empleados',
    individual_flota: '🎯 Individual flota',
    grupo_flota: '🚛 Todos flota',
};

export default function HistorialPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [nivel, setNivel] = useState(0);
    const [gremio, setGremio] = useState<'empleado' | 'flota'>('empleado');
    const [mensajes, setMensajes] = useState<MensajeHistorial[]>([]);
    const [cargando, setCargando] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [expandido, setExpandido] = useState<string | null>(null);
    const LIMIT = 20;

    useEffect(() => {
        const session = localStorage.getItem('user_session');
        if (!session) { router.replace('/'); return; }
        const u = JSON.parse(session);
        const nv = Number(u.nivel_acceso);
        if (nv < 4) { router.replace('/admin'); return; }
        setUser(u);
        setNivel(nv);
    }, [router]);

    const cargarHistorial = useCallback(async () => {
        if (!user) return;
        setCargando(true);
        try {
            const res = await fetch(`/api/telegram/historial?tipo=${gremio}&page=${page}&limit=${LIMIT}`, {
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (res.ok) { setMensajes(data.data || []); setTotal(data.total || 0); }
        } finally {
            setCargando(false);
        }
    }, [user, gremio, page]);

    useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

    const totalPages = Math.ceil(total / LIMIT);

    if (!user) return null;

    const puedeFlota = nivel >= 5;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
            {/* Header */}
            <div className="w-full bg-[#1a1a1a] px-6 py-4 rounded-[25px] border border-white/5 mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black italic uppercase tracking-tighter">
                        <span className="text-white">HISTORIAL</span>{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">MENSAJES</span>
                    </h1>
                    <p className="text-white/40 text-xs mt-0.5">{total} registros</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => router.push('/admin/mensajeria')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white transition-all">
                        ✏️ Redactar
                    </button>
                    <button onClick={() => router.push('/admin')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-all">
                        ← Volver
                    </button>
                </div>
            </div>

            {/* Tabs gremio */}
            <div className="flex gap-2 mb-4">
                {(['empleado', 'flota'] as const).map(g => (
                    <button key={g}
                        disabled={g === 'flota' && !puedeFlota}
                        onClick={() => { if (g === 'flota' && !puedeFlota) return; setGremio(g); setPage(1); }}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${gremio === g
                                ? 'bg-blue-600 text-white'
                                : g === 'flota' && !puedeFlota
                                    ? 'bg-white/3 text-white/20 cursor-not-allowed'
                                    : 'bg-[#1a1a1a] text-white/50 hover:text-white border border-white/10'
                            }`}>
                        {g === 'empleado' ? '👥 Empleados' : '🚛 Flota'}
                        {g === 'flota' && !puedeFlota && <span className="ml-1 text-[10px]">(nivel 5+)</span>}
                    </button>
                ))}
            </div>

            {/* Lista */}
            <div className="space-y-2">
                {cargando ? (
                    <div className="text-center py-16 text-white/30">Cargando...</div>
                ) : mensajes.length === 0 ? (
                    <div className="text-center py-16 text-white/30 bg-[#1a1a1a] rounded-[20px] border border-white/5">
                        <div className="text-4xl mb-3">📭</div>
                        <p>No hay mensajes enviados aún</p>
                    </div>
                ) : (
                    mensajes.map(m => (
                        <div key={m.id}
                            className="bg-[#1a1a1a] rounded-[18px] border border-white/5 overflow-hidden transition-all">
                            <button
                                onClick={() => setExpandido(expandido === m.id ? null : m.id)}
                                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/3 transition-all text-left">
                                {/* Estado */}
                                <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border ${ESTADO_COLORS[m.estado] || 'bg-white/10 text-white/40'}`}>
                                    {m.estado?.toUpperCase()}
                                </span>
                                {/* Tipo */}
                                <span className="text-white/40 text-xs shrink-0">{TIPO_LABELS[m.destinatario_tipo] || m.destinatario_tipo}</span>
                                {/* Extracto mensaje */}
                                <span className="text-white/70 text-sm flex-1 truncate">{m.mensaje_final.substring(0, 80)}</span>
                                {/* Contadores */}
                                <div className="shrink-0 flex gap-3 text-xs">
                                    <span className="text-emerald-400">{m.total_enviados} ✓</span>
                                    {m.total_errores > 0 && <span className="text-red-400">{m.total_errores} ✗</span>}
                                </div>
                                {/* Fecha */}
                                <span className="text-white/30 text-xs shrink-0">
                                    {new Date(m.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-white/30">{expandido === m.id ? '▲' : '▼'}</span>
                            </button>

                            {/* Detalle expandido */}
                            {expandido === m.id && (
                                <div className="px-5 pb-4 border-t border-white/5 pt-4 space-y-3">
                                    <div className="bg-black/30 rounded-xl p-4 text-white/80 text-sm whitespace-pre-wrap leading-relaxed">
                                        {m.mensaje_final}
                                    </div>
                                    <div className="flex gap-4 text-xs text-white/40">
                                        <span>Enviado por: <span className="text-white/60">{m.enviado_por_empleado?.nombre || '—'}</span></span>
                                        {m.etiqueta && <span>Etiqueta: <span className="text-white/60">{m.etiqueta}</span></span>}
                                    </div>
                                    <button
                                        onClick={() => { router.push(`/admin/mensajeria`); }}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-white/50 transition-all">
                                        ↩ Reenviar mensaje similar
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/50 disabled:opacity-30 hover:bg-white/10 transition-all">
                        ← Anterior
                    </button>
                    <span className="px-4 py-2 text-white/40 text-sm">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/50 disabled:opacity-30 hover:bg-white/10 transition-all">
                        Siguiente →
                    </button>
                </div>
            )}
        </div>
    );
}
