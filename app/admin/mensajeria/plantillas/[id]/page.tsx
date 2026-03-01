'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getAuthHeaders } from '@/lib/apiClient';

const CATEGORIAS = ['horario', 'descanso', 'ruta', 'emergencia', 'otro'];
const TIPOS = ['empleado', 'flota', 'ambos'];

const VARIABLES_DISPONIBLES = [
    { variable: '{nombre}', descripcion: 'Nombre completo' },
    { variable: '{fecha}', descripcion: 'Fecha actual dd/mm/aaaa' },
    { variable: '{hora}', descripcion: 'Hora actual hh:mm' },
    { variable: '{telefono}', descripcion: 'Teléfono registrado' },
    { variable: '{documento}', descripcion: 'Documento de identidad' },
    { variable: '{pin}', descripcion: 'PIN de acceso' },
    { variable: '{flota}', descripcion: 'Nombre de la flota (solo flota)' },
    { variable: '{turno}', descripcion: 'Turno asignado (solo empleados)' },
];

export default function EditorPlantillaPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const esNueva = id === 'nueva';

    const [user, setUser] = useState<any>(null);
    const [cargando, setCargando] = useState(!esNueva);
    const [guardando, setGuardando] = useState(false);
    const [notif, setNotif] = useState('');
    const [preview, setPreview] = useState('');
    const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);

    const [form, setForm] = useState({
        nombre: '', categoria: 'horario', tipo: 'empleado', contenido: '',
    });

    const notificar = (msg: string) => { setNotif(msg); setTimeout(() => setNotif(''), 3000); };

    useEffect(() => {
        const session = localStorage.getItem('user_session');
        if (!session) { router.replace('/'); return; }
        const u = JSON.parse(session);
        if (Number(u.nivel_acceso) < 6) { router.replace('/admin/mensajeria/plantillas'); return; }
        setUser(u);
    }, [router]);

    // Cargar plantilla existente
    useEffect(() => {
        if (esNueva || !user) return;
        setCargando(true);
        fetch(`/api/telegram/plantillas`, { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(d => {
                const p = (d.data || []).find((x: any) => x.id === id);
                if (p) setForm({ nombre: p.nombre, categoria: p.categoria, tipo: p.tipo, contenido: p.contenido });
            })
            .finally(() => setCargando(false));
    }, [id, esNueva, user]);

    // Preview en tiempo real
    useEffect(() => {
        if (!form.contenido) { setPreview(''); return; }
        const done = setTimeout(() => {
            if (!user) return;
            fetch('/api/telegram/preview', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: form.contenido, tipo: form.tipo }),
            }).then(r => r.json()).then(d => setPreview(d.preview || ''));
        }, 400);
        return () => clearTimeout(done);
    }, [form.contenido, form.tipo, user]);

    // Detectar variables usadas en el contenido
    const variablesUsadas = VARIABLES_DISPONIBLES
        .filter(v => form.contenido.includes(v.variable))
        .map(v => v.variable);

    // Insertar variable en la posición del cursor
    const insertarVariable = (variable: string) => {
        if (!textareaRef) {
            setForm(f => ({ ...f, contenido: f.contenido + variable }));
            return;
        }
        const start = textareaRef.selectionStart;
        const end = textareaRef.selectionEnd;
        const nuevo = form.contenido.substring(0, start) + variable + form.contenido.substring(end);
        setForm(f => ({ ...f, contenido: nuevo }));
        setTimeout(() => { textareaRef.focus(); textareaRef.setSelectionRange(start + variable.length, start + variable.length); }, 10);
    };

    const handleGuardar = async () => {
        if (!form.nombre.trim()) { notificar('Escribe un nombre para la plantilla'); return; }
        if (!form.contenido.trim()) { notificar('El contenido no puede estar vacío'); return; }

        setGuardando(true);
        try {
            const body = { ...form, variables: variablesUsadas, ...(esNueva ? {} : { id }) };
            const res = await fetch('/api/telegram/plantillas', {
                method: esNueva ? 'POST' : 'PUT',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok && data.data) {
                notificar(esNueva ? '✅ Plantilla creada' : '✅ Plantilla actualizada');
                setTimeout(() => router.push('/admin/mensajeria/plantillas'), 1000);
            } else {
                notificar(data.error || 'Error al guardar');
            }
        } finally {
            setGuardando(false);
        }
    };

    if (!user || cargando) return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/30">Cargando...</div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4">
            {notif && (
                <div className="fixed top-4 right-4 z-50 px-5 py-3 bg-emerald-600 rounded-2xl text-sm font-bold shadow-2xl animate-modal-appear">
                    {notif}
                </div>
            )}

            {/* Header */}
            <div className="w-full bg-[#1a1a1a] px-6 py-4 rounded-[25px] border border-white/5 mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black italic uppercase tracking-tighter">
                        <span className="text-white">{esNueva ? 'NUEVA' : 'EDITAR'}</span>{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">PLANTILLA</span>
                    </h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleGuardar} disabled={guardando}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50">
                        {guardando ? 'Guardando...' : '💾 Guardar'}
                    </button>
                    <button onClick={() => router.push('/admin/mensajeria/plantillas')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-all">
                        ← Cancelar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Panel izquierdo: configuración */}
                <div className="space-y-4">
                    {/* Metadatos */}
                    <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-white/5 space-y-4">
                        <div>
                            <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Nombre de la plantilla</label>
                            <input
                                value={form.nombre}
                                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                                placeholder="ej: Cambio de turno urgente"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Categoría</label>
                                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50">
                                    {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-white/50 text-xs uppercase tracking-widest block mb-2">Destinatario</label>
                                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50">
                                    {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Variables disponibles */}
                    <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-white/5">
                        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-3">Insertar variable</h3>
                        <div className="space-y-2">
                            {VARIABLES_DISPONIBLES
                                .filter(v => form.tipo !== 'empleado' || v.variable !== '{flota}')
                                .filter(v => form.tipo !== 'flota' || v.variable !== '{turno}')
                                .map(v => (
                                    <button key={v.variable} onClick={() => insertarVariable(v.variable)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${variablesUsadas.includes(v.variable)
                                                ? 'bg-blue-500/15 border border-blue-500/30'
                                                : 'bg-white/3 hover:bg-white/8 border border-white/5'
                                            }`}>
                                        <code className="text-blue-400 text-xs font-mono w-28 shrink-0">{v.variable}</code>
                                        <span className="text-white/40 text-xs">{v.descripcion}</span>
                                        {variablesUsadas.includes(v.variable) && <span className="ml-auto text-blue-400 text-xs">✓ usada</span>}
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>

                {/* Panel derecho: editor + preview */}
                <div className="space-y-4">
                    <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-white/5">
                        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-3">Contenido del mensaje</h3>
                        <textarea
                            ref={el => setTextareaRef(el)}
                            value={form.contenido}
                            onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                            rows={12}
                            maxLength={4096}
                            placeholder="Escribe el contenido de la plantilla aquí...\n\nHaz clic en una variable del panel izquierdo o escríbela manualmente.\n\nEjemplo:\nHola {nombre}, te informamos que tu turno de mañana ha cambiado.\nFecha: {fecha} | Hora: {hora}"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-blue-500/50 resize-none font-mono leading-relaxed"
                        />
                        <div className="flex justify-between mt-2 text-xs text-white/20">
                            <span>{variablesUsadas.length} variables detectadas</span>
                            <span>{form.contenido.length}/4096</span>
                        </div>
                    </div>

                    {preview && (
                        <div className="bg-[#1a1a1a] rounded-[20px] p-5 border border-blue-500/20">
                            <h3 className="text-blue-400/60 text-xs uppercase tracking-widest mb-3">Vista previa (datos de ejemplo)</h3>
                            <div className="bg-black/40 rounded-xl p-4 text-white/80 text-sm leading-relaxed whitespace-pre-wrap border border-white/5">
                                {preview}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
