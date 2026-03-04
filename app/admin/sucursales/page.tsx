'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeTable } from '@/lib/useRealtimeTable';
import type { Sucursal } from '@/lib/useSucursalActiva';

const EMPTY: Partial<Sucursal> = {
    codigo: '',
    nombre: '',
    provincia: '',
    lat: 0,
    lon: 0,
    radio_maximo: 100,
    encargado: '',
    telefono: '',
    email: '',
    empresa_nombre: '',
    activa: true,
};

export default function SucursalesPage() {
    const router = useRouter();
    const [sucursales, setSucursales] = useState<Sucursal[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<'crear' | 'editar' | null>(null);
    const [form, setForm] = useState<Partial<Sucursal>>(EMPTY);
    const [guardando, setGuardando] = useState(false);
    const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
    const [ubicandome, setUbicandome] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/sucursales');
        setSucursales(await res.json());
        setLoading(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Realtime: recarga automática cuando cambia cualquier sucursal
    useRealtimeTable('sucursales', cargar);

    const notif = (texto: string, tipo: 'ok' | 'err') => {
        setMsg({ texto, tipo });
        setTimeout(() => setMsg(null), 3500);
    };

    const abrirCrear = () => { setForm(EMPTY); setModal('crear'); };
    const abrirEditar = (s: Sucursal) => { setForm({ ...s }); setModal('editar'); };

    const ubicarme = () => {
        if (!navigator.geolocation) return;
        setUbicandome(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm(f => ({ ...f, lat: pos.coords.latitude, lon: pos.coords.longitude }));
                setUbicandome(false);
            },
            () => { setUbicandome(false); notif('No se pudo obtener GPS', 'err'); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const guardar = async () => {
        setGuardando(true);
        const method = modal === 'crear' ? 'POST' : 'PUT';
        const res = await fetch('/api/sucursales', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setGuardando(false);
        if (res.ok) {
            notif(modal === 'crear' ? 'Sucursal creada' : 'Sucursal actualizada', 'ok');
            setModal(null);
            cargar();
        } else {
            const err = await res.json();
            notif(err.error || 'Error al guardar', 'err');
        }
    };

    const campo = (key: keyof Sucursal, label: string, type = 'text') => (
        <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">{label}</label>
            <input
                type={type}
                value={(form[key] as any) ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                className="w-full bg-[#020617] border border-white/10 rounded-[12px] px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            />
        </div>
    );

    return (
        <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300">
            {/* Notificación */}
            {msg && (
                <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[9000] px-8 py-4 rounded-[20px] shadow-2xl font-black text-sm uppercase tracking-wider ${msg.tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    <span className={`font-black text-[11px] uppercase tracking-widest ${msg.tipo === 'ok' ? 'text-white' : 'text-white'}`}>
                        {msg.tipo === 'ok' ? 'OK' : 'ERROR'} — {msg.texto}
                    </span>
                </div>
            )}

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-widest italic">GESTION DE SUCURSALES</h1>
                        <p className="text-slate-500 text-xs mt-1">{sucursales.length} sede{sucursales.length !== 1 ? 's' : ''} registrada{sucursales.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={abrirCrear}
                            className="bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-[16px] transition-all active:scale-95 shadow-lg"
                        >
                            + Nueva Sucursal
                        </button>
                        <button
                            onClick={() => router.back()}
                            className="bg-white/5 hover:bg-white/10 text-slate-300 font-black text-xs uppercase tracking-wider px-5 py-3 rounded-[16px] transition-all"
                        >
                            ← Regresar
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="text-blue-500 font-black italic tracking-widest animate-pulse text-center py-20">
                        CARGANDO SUCURSALES...
                    </div>
                )}

                {/* Grid de sucursales */}
                {!loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sucursales.map(s => (
                            <div
                                key={s.id}
                                className={`bg-[#0f172a] rounded-[24px] border p-5 space-y-3 transition-all ${s.activa ? 'border-white/8' : 'border-rose-900/30 opacity-60'}`}
                            >
                                {/* Header tarjeta */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Código</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-2xl font-black text-white italic">{s.codigo}</span>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${s.activa ? 'bg-emerald-700/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400'}`}>
                                                {s.activa ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => abrirEditar(s)}
                                        className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase bg-blue-900/20 hover:bg-blue-900/40 px-3 py-1.5 rounded-[10px] transition-all"
                                    >
                                        EDITAR
                                    </button>
                                </div>

                                {/* Datos */}
                                <div>
                                    <p className="text-white font-black text-sm">{s.nombre}</p>
                                    <p className="text-slate-500 text-xs">{s.provincia}</p>
                                </div>

                                {encargado(s)}

                                {/* GPS */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-[#020617] p-2 rounded-[10px]">
                                        <p className="text-[8px] text-slate-600 uppercase tracking-wider">LAT</p>
                                        <p className="text-[11px] font-mono text-blue-400">{Number(s.lat).toFixed(5)}</p>
                                    </div>
                                    <div className="bg-[#020617] p-2 rounded-[10px]">
                                        <p className="text-[8px] text-slate-600 uppercase tracking-wider">LON</p>
                                        <p className="text-[11px] font-mono text-emerald-400">{Number(s.lon).toFixed(5)}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-600">
                                    <span>Radio: {s.radio_maximo}m</span>
                                    <span>Token: {s.timer_token / 1000}s</span>
                                </div>
                            </div>
                        ))}

                        {/* Botón añadir al final */}
                        {sucursales.length === 0 && !loading && (
                            <div className="col-span-3 flex flex-col items-center justify-center py-20 gap-4 text-slate-600">
                                <span className="text-5xl text-slate-700 font-black tracking-widest">— —</span>
                                <p className="font-black uppercase tracking-widest text-sm">No hay sucursales registradas</p>
                                <button onClick={abrirCrear} className="bg-emerald-700 hover:bg-emerald-600 text-white font-black text-sm px-6 py-3 rounded-[16px] transition-all">
                                    + Crear primera sucursal
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal crear/editar */}
            {modal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[5000] p-4">
                    <div className="bg-[#0f172a] rounded-[30px] border border-white/10 p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
                        <h2 className="text-lg font-black text-white uppercase tracking-widest">
                            {modal === 'crear' ? 'NUEVA SUCURSAL' : `EDITAR SUCURSAL ${form.codigo}`}
                        </h2>

                        {/* Código — solo editable al crear */}
                        {modal === 'crear' && (
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                    Código (2 dígitos, ej: 01)
                                </label>
                                <input
                                    type="text"
                                    maxLength={2}
                                    value={form.codigo ?? ''}
                                    onChange={e => setForm(f => ({ ...f, codigo: e.target.value.replace(/\D/g, '').padStart(0, '0').slice(0, 2) }))}
                                    className="w-full bg-[#020617] border border-white/10 rounded-[12px] px-3 py-2 text-white text-lg font-black outline-none focus:border-blue-500 transition-colors"
                                    placeholder="01"
                                />
                            </div>
                        )}

                        {campo('nombre', 'Nombre de la sucursal')}
                        {campo('provincia', 'Provincia / Ciudad')}
                        {campo('empresa_nombre', 'Nombre del sistema para esta sede')}
                        {campo('encargado', 'Encargado')}
                        {campo('telefono', 'Teléfono')}
                        {campo('email', 'Email')}

                        {/* GPS con botón ubícame */}
                        <div className="space-y-2">
                            <button
                                onClick={ubicarme}
                                disabled={ubicandome}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                                {ubicandome ? 'Detectando GPS...' : 'USAR MI UBICACION ACTUAL'}
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                {campo('lat', 'Latitud', 'number')}
                                {campo('lon', 'Longitud', 'number')}
                            </div>
                            {campo('radio_maximo', 'Radio de geocerca (metros)', 'number')}
                        </div>

                        {/* Config de la sucursal */}
                        <div className="border-t border-white/5 pt-4 space-y-3">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">CONFIGURACION DE ESTA SEDE</p>
                            <div className="grid grid-cols-2 gap-3">
                                {campo('timer_token', 'Expiración token QR (ms)', 'number')}
                                {campo('timer_inactividad', 'Timeout inactividad (ms)', 'number')}
                                {campo('maximo_labor', 'Máx. jornada laboral (ms)', 'number')}
                                {campo('porcentaje_efectividad', '% Efectividad mínima', 'number')}
                            </div>
                        </div>

                        {/* Activa toggle */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setForm(f => ({ ...f, activa: !f.activa }))}
                                className={`w-12 h-6 rounded-full transition-all ${form.activa ? 'bg-emerald-600' : 'bg-slate-700'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow transition-all mx-0.5 ${form.activa ? 'translate-x-6' : ''}`} />
                            </button>
                            <span className="text-xs font-black text-slate-400 uppercase">
                                Sucursal {form.activa ? 'Activa' : 'Inactiva'}
                            </span>
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-3">
                            <button
                                onClick={guardar}
                                disabled={guardando || !form.codigo || !form.nombre}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-wider py-3 rounded-[16px] transition-all disabled:opacity-40"
                            >
                                {guardando ? 'GUARDANDO...' : 'GUARDAR'}
                            </button>
                            <button
                                onClick={() => setModal(null)}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-black text-sm rounded-[16px] transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

function encargado(s: Sucursal) {
    if (!s.encargado && !s.telefono) return null;
    return (
        <div className="text-xs text-slate-500 space-y-0.5">
            {s.encargado && <p className="text-slate-400">{s.encargado}</p>}
            {s.telefono && <p className="text-emerald-500/70 font-mono">{s.telefono}</p>}
        </div>
    );
}
