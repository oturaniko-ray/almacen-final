'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [vista, setVista] = useState<'menu' | 'empleados' | 'movimientos'>('menu');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [mostrarPinId, setMostrarPinId] = useState<string | null>(null);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  // Identificador único de esta instancia de pestaña
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    // 1. RECUPERAR SESIÓN SEGÚN LOGINPAGE (REGLA DE ORO)
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);

    fetchEmpleados();
    fetchMovimientos();

    // 2. CANAL DE SEGURIDAD SEGMENTADO POR EMAIL (SÓLO ESTE AJUSTE)
    const canalRealtime = supabase.channel('security-monitor');
    
    canalRealtime
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empleados' }, (payload) => {
          setEmpleados(current => current.map(emp => emp.id === payload.new.id ? { ...emp, ...payload.new } : emp));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registros_acceso' }, () => { fetchMovimientos(); })
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        // SEGMENTACIÓN: Si el email coincide pero el ID de sesión es distinto, expulsar
        if (payload.payload.userEmail === currentUser.email && payload.payload.sid !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => { 
            localStorage.removeItem('user_session'); 
            router.push('/'); 
          }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Notificar que este usuario (email) ha abierto una nueva sesión
          await canalRealtime.send({
            type: 'broadcast',
            event: 'nueva-sesion',
            payload: { sid: sessionId.current, userEmail: currentUser.email },
          });
        }
      });

    return () => { supabase.removeChannel(canalRealtime); };
  }, [router]);

  async function fetchEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }

  async function fetchMovimientos() {
    const { data } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false }).limit(200);
    if (data) setMovimientos(data);
  }

  const validarPinUnico = (pin: string, idExcluir?: string) => {
    return !empleados.some(emp => emp.pin_seguridad === pin && emp.id !== idExcluir);
  };

  async function guardarEmpleado() {
    if (!nuevo.nombre || !nuevo.documento_id || !nuevo.pin_seguridad) { alert("Faltan datos."); return; }
    if (!validarPinUnico(nuevo.pin_seguridad)) { alert("❌ PIN duplicado."); return; }
    const { error } = await supabase.from('empleados').insert([{ ...nuevo, en_almacen: false, activo: true }]);
    if (!error) { setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' }); fetchEmpleados(); }
  }

  async function actualizarEmpleado() {
    if (!editando || !validarPinUnico(editando.pin_seguridad, editando.id)) { alert("❌ PIN inválido o duplicado."); return; }
    const { error } = await supabase.from('empleados').update(editando).eq('id', editando.id);
    if (!error) { setEditando(null); fetchEmpleados(); }
  }

  async function toggleActivo(id: string, estadoActual: boolean) {
    await supabase.from('empleados').update({ activo: !estadoActual }).eq('id', id);
    fetchEmpleados();
  }

  const parseDetalles = (detalles: string) => {
    const modo = detalles.includes('MANUAL') ? 'MANUAL' : (detalles.includes('USB') ? 'USB' : 'CÁMARA');
    const autorizaMatch = detalles.match(/Autoriza: (.*)/i);
    return { modo, autoriza: autorizaMatch ? autorizaMatch[1] : 'Sistema' };
  };

  // PANTALLA DE BLOQUEO POR SESIÓN DUPLICADA
  if (sesionDuplicada) {
    return (
      <main className="h-screen bg-black flex items-center justify-center p-10 text-center">
        <div className="bg-red-600/20 border-2 border-red-600 p-10 rounded-[40px] shadow-[0_0_50px_rgba(220,38,38,0.3)] animate-pulse">
          <h2 className="text-4xl font-black text-red-500 mb-4 uppercase italic tracking-tighter">Sesión Duplicada</h2>
          <p className="text-white text-xl font-bold max-w-md">El administrador {user?.email} ha iniciado sesión en otro dispositivo. Esta ventana se cerrará.</p>
        </div>
      </main>
    );
  }

  if (vista === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-black uppercase italic text-blue-500 mb-10 tracking-tighter">Panel Administrativo</h1>
        <div className="w-full max-w-sm space-y-5">
          <button onClick={() => setVista('empleados')} className="w-full p-10 bg-[#0f172a] border border-white/5 rounded-[30px] font-black text-xl uppercase hover:bg-blue-600 transition-all shadow-2xl">👥 Gestión Personal</button>
          <button onClick={() => setVista('movimientos')} className="w-full p-10 bg-[#0f172a] border border-white/5 rounded-[30px] font-black text-xl uppercase hover:bg-emerald-600 transition-all shadow-2xl">🕒 Historial Accesos</button>
          <button onClick={() => { localStorage.removeItem('user_session'); router.push('/'); }} className="w-full p-4 mt-6 text-slate-500 font-black uppercase text-[14px] hover:text-white transition-colors">← Salir</button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-[#050a14] text-white font-sans flex flex-col overflow-hidden">
      <style jsx global>{`
        @keyframes flash-strong { 0%, 100% { opacity: 1; background-color: rgba(16, 185, 129, 0.15); } 50% { opacity: 0.4; background-color: transparent; } }
        .animate-flash { animation: flash-strong 0.8s infinite ease-in-out; }
      `}</style>

      {/* CABECERA FIJA - SEGÚN CAPTURAS */}
      <div className="flex-none p-6 border-b border-white/5 bg-[#050a14] z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-6">
          <button onClick={() => setVista('menu')} className="bg-slate-800 px-6 py-3 rounded-xl text-[13px] font-black uppercase">← Menú</button>
          <h2 className="text-[14px] font-black uppercase tracking-[0.3em] text-blue-500">
            {vista === 'empleados' ? 'REGISTRO Y EDICIÓN' : 'HISTORIAL DE MOVIMIENTOS'}
          </h2>
          <div className="text-[10px] text-slate-500 font-bold uppercase">{user?.nombre}</div>
        </div>

        {vista === 'empleados' ? (
          <div className={`max-w-7xl mx-auto p-6 rounded-[30px] border transition-all ${editando ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#0f172a] border-white/5'}`}>
            <div className="grid grid-cols-5 gap-4">
              <input type="text" placeholder="Nombre" className="bg-slate-950 p-4 rounded-xl border border-white/5 text-[15px] outline-none" value={editando ? editando.nombre : nuevo.nombre} onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} />
              <input type="text" placeholder="ID" className="bg-slate-950 p-4 rounded-xl border border-white/5 text-[15px] outline-none" value={editando ? editando.documento_id : nuevo.documento_id} onChange={e => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} />
              <input type="email" placeholder="Email" className="bg-slate-950 p-4 rounded-xl border border-white/5 text-[15px] outline-none" value={editando ? editando.email : nuevo.email} onChange={e => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} />
              <input type="text" placeholder="PIN" className="bg-slate-950 p-4 rounded-xl border border-white/5 text-[15px] outline-none" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} />
              <button onClick={editando ? actualizarEmpleado : guardarEmpleado} className={`rounded-xl font-black uppercase text-[12px] ${editando ? 'bg-amber-500 text-black' : 'bg-blue-600'}`}>{editando ? 'ACTUALIZAR' : 'GUARDAR'}</button>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-2 gap-6">
            <div className="relative">
              <input type="text" placeholder="🔍 Buscar por nombre o autorizador..." className="w-full bg-[#0f172a] border border-white/5 p-5 pr-14 rounded-2xl text-[15px] outline-none" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              {busqueda && <button onClick={() => setBusqueda('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 font-black">✕</button>}
            </div>
            <input type="date" className="bg-[#0f172a] border border-white/5 p-5 rounded-2xl text-[15px] outline-none text-slate-400" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} />
          </div>
        )}
      </div>

      {/* TABLAS CON SCROLL Y MEMBRETES STICKY - RESPETANDO CAPTURAS SUBIDAS */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-hide bg-[#050a14]">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#0f172a] rounded-[35px] border border-white/5 shadow-2xl overflow-hidden">
            <table className="w-full text-left text-[14px] table-fixed border-collapse">
              <thead className="bg-[#1e293b] uppercase text-slate-400 font-black sticky top-0 z-30 border-b border-white/5">
                <tr>
                  {vista === 'empleados' ? (
                    <>
                      <th className="p-5 w-20 text-center">Loc</th>
                      <th className="p-5">Nombre / Email</th>
                      <th className="p-5 w-32 text-center">Rol</th>
                      <th className="p-5 w-52">Doc / PIN Seguridad</th>
                      <th className="p-5 w-32 text-center">Estado</th>
                      <th className="p-5 w-20 text-center">Acción</th>
                    </>
                  ) : (
                    <>
                      <th className="p-5">Empleado</th>
                      <th className="p-5 w-32 text-center">Tipo</th>
                      <th className="p-5 w-36 text-center">Modo</th>
                      <th className="p-5 text-center">Autorizado por</th>
                      <th className="p-5 w-40 text-center">Hora</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {vista === 'empleados' ? (
                  empleados.filter(e => e.nombre.toLowerCase().includes(busqueda.toLowerCase()) || e.email.toLowerCase().includes(busqueda.toLowerCase())).map(emp => (
                    <tr key={emp.id} className="hover:bg-white/[0.02]">
                      <td className="p-5 text-center"><div className={`w-3 h-3 rounded-full mx-auto ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></div></td>
                      <td className="p-5"><b>{emp.nombre}</b><br/><span className="text-[11px] text-slate-500">{emp.email}</span></td>
                      <td className="p-5 text-center font-black text-[11px] uppercase">
                        <span className="bg-slate-800 px-3 py-1 rounded-md border border-white/5">{emp.rol}</span>
                      </td>
                      <td className="p-5">
                         <div className="font-mono text-blue-400 mb-1">{emp.documento_id}</div>
                         <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-[10px]">••••</span>
                            <button onMouseEnter={() => setMostrarPinId(emp.id)} onMouseLeave={() => setMostrarPinId(null)} className="opacity-40 hover:opacity-100">👁</button>
                            {mostrarPinId === emp.id && <span className="text-[10px] font-bold text-amber-500">{emp.pin_seguridad}</span>}
                         </div>
                      </td>
                      <td className="p-5 text-center">
                        <button onClick={() => toggleActivo(emp.id, emp.activo)} className={`text-[10px] font-black px-3 py-1 rounded-lg border ${emp.activo ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : 'text-red-500 border-red-500/30 bg-red-500/10'}`}>
                          {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                        </button>
                      </td>
                      <td className="p-5 text-center">
                        <button onClick={() => setEditando(emp)} className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20">✎</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  movimientos.filter(m => m.nombre_empleado.toLowerCase().includes(busqueda.toLowerCase()) || m.detalles.toLowerCase().includes(busqueda.toLowerCase())).map((mov, index, array) => {
                    const info = parseDetalles(mov.detalles || '');
                    const esNuevoDia = index === 0 || new Date(mov.fecha_hora).toLocaleDateString() !== new Date(array[index-1].fecha_hora).toLocaleDateString();
                    return (
                      <React.Fragment key={mov.id}>
                        {esNuevoDia && (
                          <tr className="animate-flash"><td colSpan={5} className="p-3 text-center text-[11px] font-black text-emerald-500 tracking-[0.5em] bg-emerald-500/5">🗓️ {new Date(mov.fecha_hora).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join(' / ')}</td></tr>
                        )}
                        <tr className="hover:bg-white/[0.01]">
                          <td className="p-5 font-bold">{mov.nombre_empleado}</td>
                          <td className="p-5 text-center">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-md ${mov.tipo_movimiento === 'entrada' ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-500 bg-red-500/10 border border-red-500/20'}`}>
                              {mov.tipo_movimiento.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-5 text-center uppercase text-[11px] font-black text-slate-500">{info.modo}</td>
                          <td className="p-5 text-center text-blue-400 font-bold">{info.autoriza}</td>
                          <td className="p-5 text-center text-slate-500 font-mono italic">{new Date(mov.fecha_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}