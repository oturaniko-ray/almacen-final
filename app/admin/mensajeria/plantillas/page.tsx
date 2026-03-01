'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/apiClient';

interface Plantilla {
    id: string;
    nombre: string;
    categoria: string;
    tipo: string;
    contenido: string;
    variables: string[];
    activo: boolean;
}

const CATEGORIAS = ['horario', 'descanso', 'ruta', 'emergencia', 'otro'];
const TIPOS = ['empleado', 'flota', 'ambos'];

const CAT_COLORS: Record<string, string> = {
    horario: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    descanso: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    ruta: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    emergencia: 'bg-red-500/20 text-red-400 border-red-500/30',
    otro: 'bg-white/10 text-white/50 border-white/20',
};

export default function PlantillasPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [nivel, setNivel] = useState(0);
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [filtroCat, setFiltroCat] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [cargando, setCargando] = useState(false);
    const [eliminando, setEliminando] = useState<string | null>(null);
    const [notif, setNotif] = useState('');

    useEffect(() => {
        const session = localStorage.getItem('user_session');
        if (!session) { router.replace('/'); return; }
        const u = JSON.parse(session);
        const nv = Number(u.nivel_acceso);
        if (nv < 6) { router.replace('/admin/mensajeria'); return; }
        setUser(u); setNivel(nv);
    }, [router]);

    const cargar = useCallback(async () => {
        if (!user) return;
        setCargando(true);
        const params = new URLSearchParams();
        if (filtroTipo) params.set('tipo', filtroTipo);
        if (filtroCat) params.set('categoria', filtroCat);
        const res = await fetch(`/api/telegram/plantillas?${params}`, { headers: getAuthHeaders() });
        const data = await res.json();
        setPlantillas(data.data || []);
        setCargando(false);
    }, [user, filtroTipo, filtroCat]);

    useEffect(() => { cargar(); }, [cargar]);

    const eliminar = async (id: string) => {
        if (!confirm('¿Eliminar esta plantilla?')) return;
        setEliminando(id);
        await fetch(`/api/telegram/plantillas?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        setNotif('Plantilla eliminada');
        setTimeout(() => setNotif(''), 2000);
        cargar();
        setEliminando(null);
    };

    if (!user) return null;

    const agrupadas = CATEGORIAS.reduce((acc, cat) => {
        const grupo = plantillas.filter(p => p.categoria === cat);
        if (grupo.length > 0) acc[cat] = grupo;
        return acc;
    }, {} as Record<string, Plantilla[]>);

    const sinCategoria = plantillas.filter(p => !CATEGORIAS.includes(p.categoria));
    if (sinCategoria.length) agrupadas['otro'] = [...(agrupadas['otro'] || []), ...sinCategoria];

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
            {notif && (
                <div className="fixed top-4 right-4 z-50 px-5 py-3 bg-emerald-600 rounded-2xl text-sm font-bold shadow-2xl">
                    {notif}
                </div>
            )}

            {/* Header */}
            <div className="w-full bg-[#1a1a1a] px-6 py-4 rounded-[25px] border border-white/5 mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black italic uppercase tracking-tighter">
                        <span className="text-white">PLANTILLAS</span>{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">TELEGRAM</span>
                    </h1>
                    <p className="text-white/40 text-xs mt-0.5">{plantillas.length} plantillas activas</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => router.push('/admin/mensajeria/plantillas/nueva')}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white transition-all">
                        + Nueva plantilla
                    </button>
                    <button onClick={() => router.push('/admin/mensajeria')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-all">
                        ← Volver
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 mb-4 flex-wrap">
                <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)}
                    className="bg-[#1a1a1a] border border-white/10 text-white/70 text-sm rounded-xl px-4 py-2 outline-none">
                    <option value="">Todas las categorías</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                    className="bg-[#1a1a1a] border border-white/10 text-white/70 text-sm rounded-xl px-4 py-2 outline-none">
                    <option value="">Todos los tipos</option>
                    {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
            </div>

            {/* Grid de plantillas agrupadas por categoría */}
            {cargando ? (
                <div className="text-center py-16 text-white/30">Cargando...</div>
            ) : plantillas.length === 0 ? (
                <div className="text-center py-16 text-white/30 bg-[#1a1a1a] rounded-[20px] border border-white/5">
                    <div className="text-4xl mb-3">📌</div>
                    <p className="mb-4">No hay plantillas creadas</p>
                    <button onClick={() => router.push('/admin/mensajeria/plantillas/nueva')}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white transition-all">
                        Crear primera plantilla
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(agrupadas).map(([cat, lista]) => (
                        <div key={cat}>
                            <h3 className="text-white/40 text-xs uppercase tracking-widest mb-2 pl-1">
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {lista.map(p => (
                                    <div key={p.id}
                                        className="bg-[#1a1a1a] rounded-[18px] p-5 border border-white/5 hover:border-white/10 transition-all flex flex-col gap-3">
                                        {/* Badges */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${CAT_COLORS[p.categoria] || CAT_COLORS['otro']}`}>
                                                {p.categoria}
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-white/8 text-white/40 border border-white/10">
                                                {p.tipo}
                                            </span>
                                        </div>
                                        {/* Nombre */}
                                        <h4 className="text-white font-bold">{p.nombre}</h4>
                                        {/* Contenido */}
                                        <p className="text-white/40 text-sm leading-relaxed line-clamp-3">{p.contenido}</p>
                                        {/* Variables */}
                                        {p.variables?.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {p.variables.map(v => (
                                                    <span key={v} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-md font-mono">
                                                        {v}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Acciones */}
                                        <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
                                            <button onClick={() => router.push(`/admin/mensajeria/plantillas/${p.id}`)}
                                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white/50 transition-all font-bold">
                                                ✏️ Editar
                                            </button>
                                            <button
                                                onClick={() => eliminar(p.id)}
                                                disabled={eliminando === p.id}
                                                className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs text-red-400 transition-all font-bold">
                                                {eliminando === p.id ? '...' : '🗑️ Eliminar'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
