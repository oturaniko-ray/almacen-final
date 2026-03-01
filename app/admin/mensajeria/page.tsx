'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';

// ── Tipos ──────────────────────────────────────────────────────────
type Gremio = 'empleado' | 'flota';
type Alcance = 'todos' | 'individual';

interface Destinatario { id: string; nombre: string; }
interface Plantilla { id: string; nombre: string; categoria: string; contenido: string; }
interface Notif { mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null; }

const VARIABLES = ['{nombre}', '{fecha}', '{hora}', '{telefono}', '{documento}', '{pin}', '{flota}'];

// ── Componente ──────────────────────────────────────────────────────
export default function MensajeriaPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [nivel, setNivel] = useState(0);
    const [gremio, setGremio] = useState<Gremio>('empleado');
    const [alcance, setAlcance] = useState<Alcance>('todos');
    const [individualId, setIndividualId] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
    const [mensaje, setMensaje] = useState('');
    const [preview, setPreview] = useState('');
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [notif, setNotif] = useState<Notif>({ mensaje: '', tipo: null });
    const [conteo, setConteo] = useState<number | null>(null);

    const notificar = (msg: string, tipo: Notif['tipo']) => {
        setNotif({ mensaje: msg, tipo });
        setTimeout(() => setNotif({ mensaje: '', tipo: null }), 3500);
    };

    // Verificar sesión y nivel
    useEffect(() => {
        const session = localStorage.getItem('user_session');
        if (!session) { router.replace('/'); return; }
        const u = JSON.parse(session);
        const nv = Number(u.nivel_acceso);
        if (nv < 4) { router.replace('/admin'); return; }
        setUser(u);
        setNivel(nv);
    }, [router]);

    // Cargar plantillas
    useEffect(() => {
        if (!user) return;
        fetch(`/api/telegram/plantillas?tipo=${gremio}`, { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(d => setPlantillas(d.data || []));
    }, [user, gremio]);

    // Cargar destinatarios para buscador individual
    const cargarDestinatarios = useCallback(async () => {
        if (!busqueda.trim()) { setDestinatarios([]); return; }
        const tabla = gremio === 'empleado' ? 'empleados' : 'flota_perfil';
        const campoNombre = gremio === 'empleado' ? 'nombre' : 'nombre_completo';
        const { data } = await (supabase as any)
            .from(tabla)
            .select(`id, ${campoNombre}`)
            .ilike(campoNombre, `%${busqueda}%`)
            .eq('activo', true)
            .limit(10);
        setDestinatarios((data || []).map((d: any) => ({ id: d.id, nombre: d[campoNombre] })));
    }, [busqueda, gremio]);

    useEffect(() => { const t = setTimeout(cargarDestinatarios, 300); return () => clearTimeout(t); }, [cargarDestinatarios]);

    // Contar destinatarios activos
    useEffect(() => {
        if (!user || alcance !== 'todos') { setConteo(null); return; }
        (supabase as any)
            .from('telegram_usuarios')
            .select('id', { count: 'exact', head: true })
            .eq('tipo', gremio)
            .eq('activo', true)
            .then(({ count }: any) => setConteo(count || 0));
    }, [user, gremio, alcance]);

    // Preview en tiempo real
    useEffect(() => {
        if (!mensaje.trim()) { setPreview(''); return; }
        const t = setTimeout(() => {
            fetch('/api/telegram/preview', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: mensaje, tipo: gremio, destinatario_id: alcance === 'individual' ? individualId : undefined }),
            }).then(r => r.json()).then(d => setPreview(d.preview || ''));
        }, 400);
        return () => clearTimeout(t);
    }, [mensaje, gremio, alcance, individualId]);

    const insertarVariable = (variable: string) => {
        setMensaje(prev => prev + variable);
    };

    const handleEnviar = async () => {
        if (!mensaje.trim()) { notificar('Escribe un mensaje antes de enviar', 'advertencia'); return; }
        if (alcance === 'individual' && !individualId) { notificar('Selecciona un destinatario', 'advertencia'); return; }

        setEnviando(true);
        try {
            const res = await fetch('/api/telegram/send', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo: gremio, alcance, destinatario_id: alcance === 'individual' ? individualId : undefined, mensaje }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                notificar(`✅ Enviado: ${data.enviados} mensajes${data.errores > 0 ? ` (${data.errores} fallidos)` : ''}`, 'exito');
                setMensaje('');
                setPreview('');
                setIndividualId('');
                setBusqueda('');
            } else {
                notificar(data.error || 'Error al enviar', 'error');
            }
        } catch (e: any) {
            notificar(e.message, 'error');
        } finally {
            setEnviando(false);
        }
    };

    if (!user) return null;

    const puedeFlota = nivel >= 5;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
            {/* Notificación */}
            {notif.tipo && (
                <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-modal-appear ${notif.tipo === 'exito' ? 'bg-emerald-600' : notif.tipo === 'error' ? 'bg-red-600' : 'bg-amber-600'
                    }`}>{notif.mensaje}</div>
            )}

            {/* Header */}
            <div className="w-full bg-[#1a1a1a] px-6 py-4 rounded-[25px] border border-white/5 mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black italic uppercase tracking-tighter">
                        <span className="text-white">MENSAJERÍA</span>{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">TELEGRAM</span>
                    </h1>
                    <p className="text-white/40 text-xs mt-0.5">Módulo de comunicación con empleados y flota</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => router.push('/admin/mensajeria/historial')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-all">
                        📋 Historial
                    </button>
                    {nivel >= 6 && (
                        <button onClick={() => router.push('/admin/mensajeria/plantillas')}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-all">
                            📌 Plantillas
                        </button>
                    )}
                    <button onClick={() => router.push('/admin')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-all">
                        ← Volver
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Panel izquierdo: configuración del envío */}
                <div className="space-y-4">

                    {/* Selector de gremio */}
                    <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-white/5">
                        <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">Destinatarios</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {(['empleado', 'flota'] as const).map(g => (
                                <button key={g}
                                    onClick={() => { if (g === 'flota' && !puedeFlota) return; setGremio(g); setIndividualId(''); setBusqueda(''); }}
                                    disabled={g === 'flota' && !puedeFlota}
                                    className={`py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${gremio === g
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                            : g === 'flota' && !puedeFlota
                                                ? 'bg-white/3 text-white/20 cursor-not-allowed border border-white/5'
                                                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                                        }`}>
                                    {g === 'empleado' ? '👥 Empleados' : '🚛 Flota'}
                                    {g === 'flota' && !puedeFlota && <span className="block text-[10px] mt-0.5">Nivel 5+</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Alcance */}
                    <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-white/5">
                        <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">Alcance</h2>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {(['todos', 'individual'] as const).map(a => (
                                <button key={a} onClick={() => { setAlcance(a); setIndividualId(''); setBusqueda(''); }}
                                    className={`py-2.5 rounded-xl font-bold text-sm transition-all ${alcance === a ? 'bg-cyan-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/10'
                                        }`}>
                                    {a === 'todos' ? '📣 Todos' : '🎯 Individual'}
                                </button>
                            ))}
                        </div>

                        {alcance === 'todos' && conteo !== null && (
                            <div className="text-center py-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <span className="text-blue-400 font-black text-lg">{conteo}</span>
                                <span className="text-white/40 text-sm ml-2">usuarios con Telegram vinculado</span>
                            </div>
                        )}

                        {alcance === 'individual' && (
                            <div>
                                <input
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    placeholder={`Buscar ${gremio === 'empleado' ? 'empleado' : 'chofer'}...`}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-blue-500/50 mb-2"
                                />
                                {destinatarios.length > 0 && (
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {destinatarios.map(d => (
                                            <button key={d.id} onClick={() => { setIndividualId(d.id); setBusqueda(d.nombre); setDestinatarios([]); }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${individualId === d.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                                                    }`}>
                                                {d.nombre}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {individualId && (
                                    <div className="mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                                        ✅ Seleccionado: {busqueda}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Plantillas */}
                    {plantillas.length > 0 && (
                        <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-white/5">
                            <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">Plantillas disponibles</h2>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {plantillas.map(p => (
                                    <button key={p.id} onClick={() => setMensaje(p.contenido)}
                                        className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group">
                                        <div className="text-white/80 text-sm font-bold group-hover:text-white">{p.nombre}</div>
                                        <div className="text-white/30 text-xs mt-0.5 truncate">{p.contenido.substring(0, 60)}...</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Panel derecho: redactor */}
                <div className="space-y-4">
                    {/* Editor de mensaje */}
                    <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-white/5">
                        <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">Mensaje</h2>

                        {/* Insertar variables */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {VARIABLES.filter(v => v !== '{flota}' || gremio === 'flota').map(v => (
                                <button key={v} onClick={() => insertarVariable(v)}
                                    className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 rounded-lg text-blue-400 text-xs font-mono transition-all">
                                    {v}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={mensaje}
                            onChange={e => setMensaje(e.target.value)}
                            rows={8}
                            maxLength={4096}
                            placeholder={`Escribe tu mensaje aquí...\n\nPuedes usar las variables de arriba para personalizar el mensaje.`}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-blue-500/50 resize-none font-mono leading-relaxed"
                        />
                        <div className="text-right text-white/20 text-xs mt-1">{mensaje.length}/4096</div>
                    </div>

                    {/* Vista previa */}
                    {preview && (
                        <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-blue-500/20">
                            <h2 className="text-blue-400/60 text-xs uppercase tracking-widest mb-3">Vista previa</h2>
                            <div className="bg-black/40 rounded-xl p-4 text-white/80 text-sm leading-relaxed whitespace-pre-wrap border border-white/5">
                                {preview}
                            </div>
                        </div>
                    )}

                    {/* Botón de envío */}
                    <button
                        onClick={handleEnviar}
                        disabled={enviando || !mensaje.trim()}
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 ${enviando || !mensaje.trim()
                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20'
                            }`}>
                        {enviando ? '⏳ Enviando...' : `📤 Enviar a ${alcance === 'todos'
                            ? `todos los ${gremio === 'empleado' ? 'empleados' : 'choferes'}${conteo !== null ? ` (${conteo})` : ''}`
                            : busqueda || 'destinatario seleccionado'}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
