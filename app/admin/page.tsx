'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [vista, setVista] = useState<'menu' | 'empleados' | 'movimientos'>('menu');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [busquedaMov, setBusquedaMov] = useState('');
  const [filtroFecha, setFiltroFecha] = useState(''); 
  const [mostrarPinId, setMostrarPinId] = useState<string | null>(null);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
  const router = useRouter();

  useEffect(() => {
    fetchEmpleados();
    fetchMovimientos();
    const canalRealtime = supabase
      .channel('admin-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empleados' }, (payload) => {
          setEmpleados(current => current.map(emp => emp.id === payload.new.id ? { ...emp, ...payload.new } : emp));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registros_acceso' }, () => { fetchMovimientos(); })
      .subscribe();
    return () => { supabase.removeChannel(canalRealtime); };
  }, []);

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
    if (!nuevo.nombre || !nuevo.documento_id || !nuevo.pin_seguridad) {
      alert("Por favor, complete Nombre, Documento y PIN."); return;
    }
    if (!validarPinUnico(nuevo.pin_seguridad)) {
      alert("❌ ERROR: El PIN ya está en uso."); return;
    }
    const { error } = await supabase.from('empleados').insert([{ ...nuevo, en_almacen: false, activo: true }]);
    if (!error) {
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
      fetchEmpleados();
      alert("✅ Empleado registrado con éxito");
    } else {
      alert("Error al registrar: " + error.message);
    }
  }

  // --- RESTAURACIÓN DE LA LÓGICA DE ACTUALIZACIÓN ---
  async function actualizarEmpleado() {
    if (!editando) return;
    if (!validarPinUnico(editando.pin_seguridad, editando.id)) {
      alert("❌ ERROR: El nuevo PIN ya pertenece a otro empleado."); return;
    }

    const { error } = await supabase.from('empleados').update({
      nombre: editando.nombre,
      documento_id: editando.documento_id,
      email: editando.email,
      pin_seguridad: editando.pin_seguridad,
      rol: editando.rol
    }).eq('id', editando.id);

    if (!error) {
      setEditando(null); // Sale del modo edición
      fetchEmpleados(); // Recarga la lista
      alert("✅ Información actualizada en la base de datos");
    } else {
      alert("Error al actualizar: " + error.message);
    }
  }

  const parseDetalles = (detalles: string) => {
    const modo = detalles.includes('MANUAL') ? 'MANUAL' : (detalles.includes('USB') ? 'USB' : 'CÁMARA');
    const autorizaMatch = detalles.match(/Autoriza: (.*)/i);
    return { modo, autoriza: autorizaMatch ? autorizaMatch[1] : 'Sistema' };
  };

  if (vista === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-black uppercase italic text-blue-500 mb-10 tracking-tighter">PANEL DEL ADMINISTRADOR</h1>
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setVista('empleados')} className="w-full p-8 bg-[#0f172a] border border-white/5 rounded-[30px] font-black uppercase italic hover:bg-blue-600 transition-all shadow-2xl">👥 Gestión de Empleados</button>
          <button onClick={() => setVista('movimientos')} className="w-full p-8 bg-[#0f172a] border border-white/5 rounded-[30px] font-black uppercase italic hover:bg-emerald-600 transition-all shadow-2xl">🕒 Movimientos(Entradas/Salidas)</button>
          <button onClick={() => router.push('/')} className="w-full p-4 mt-6 text-slate-500 font-black uppercase text-[10px] hover:text-white transition-colors">← Salir al Inicio</button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-[#050a14] text-white font-sans flex flex-col overflow-hidden">
      
      {/* CABECERA FIJA */}
      <div className="flex-none p-4 border-b border-white/5 bg-[#050a14] z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-4">
          <button onClick={() => {setVista('menu'); setEditando(null);}} className="bg-slate-800 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-slate-700 transition-colors">← Menú Principal</button>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">
            {vista === 'empleados' ? 'REGISTRO Y EDICIÓN' : 'HISTORIAL DE MOVIMIENTOS'}
          </h2>
          <div className="w-20"></div>
        </div>

        {vista === 'empleados' ? (
          <div className={`max-w-7xl mx-auto p-5 rounded-[30px] border transition-all duration-500 shadow-2xl ${editando ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#0f172a] border-white/5'}`}>
            <div className="grid grid-cols-5 gap-3">
              <input type="text" placeholder="Nombre" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.nombre : nuevo.nombre} onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} />
              <input type="text" placeholder="Doc ID" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.documento_id : nuevo.documento_id} onChange={e => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} />
              <input type="email" placeholder="Email" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.email : nuevo.email} onChange={e => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} />
              <input type="text" placeholder="PIN" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} />
              <div className="flex gap-2">
                <select className="flex-1 bg-slate-950 p-3 rounded-xl border border-white/5 text-[10px] font-bold" value={editando ? editando.rol : nuevo.rol} onChange={e => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
                  <option value="empleado">Empleado</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
                <button 
                  onClick={editando ? actualizarEmpleado : guardarEmpleado} 
                  className={`flex-[1.5] rounded-xl font-black uppercase text-[9px] transition-all ${editando ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-blue-600 hover:bg-blue-500'}`}
                >
                  {editando ? 'ACTUALIZAR' : 'GUARDAR'}
                </button>
                {editando && (
                  <button onClick={() => setEditando(null)} className="px-3 bg-slate-800 rounded-xl font-black text-slate-400 hover:text-white">✕</button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4">
            <input 
              type="text" placeholder="🔍 Buscar por nombre o autorizador..." 
              className="bg-[#0f172a] border border-white/5 p-4 rounded-2xl text-[11px] outline-none focus:border-emerald-500/50"
              value={busquedaMov} onChange={(e) => setBusquedaMov(e.target.value)}
            />
            <input 
              type="date" 
              className="bg-[#0f172a] border border-white/5 p-4 rounded-2xl text-[11px] outline-none text-slate-400"
              value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* CUERPO CON SCROLL */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#0f172a] rounded-[30px] border border-white/5 shadow-2xl overflow-hidden">
            {vista === 'empleados' ? (
              <table className="w-full text-left text-[10px] table-fixed border-collapse">
                <thead className="bg-[#1e293b] uppercase text-slate-400 font-black sticky top-0 z-30 shadow-md">
                  <tr>
                    <th className="p-4 w-16 text-center">Status</th>
                    <th className="p-4">Nombre / Email</th>
                    <th className="p-4 w-24 text-center">Rol</th>
                    <th className="p-4 w-40">Doc / PIN Seguridad</th>
                    <th className="p-4 w-24 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#0f172a]">
                  {empleados.map(emp => (
                    <tr key={emp.id} className={`hover:bg-white/[0.02] transition-colors ${editando?.id === emp.id ? 'bg-blue-500/5' : ''}`}>
                      <td className="p-4 text-center">
                        <div className={`w-3 h-3 rounded-full mx-auto ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-200">{emp.nombre}</div>
                        <div className="text-[9px] text-slate-500">{emp.email}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-1 bg-white/5 rounded text-[8px] uppercase">{emp.rol}</span>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-blue-400">{emp.documento_id}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-slate-500 font-mono">
                            {mostrarPinId === emp.id ? emp.pin_seguridad : '••••'}
                          </span>
                          <button 
                            onMouseDown={() => setMostrarPinId(emp.id)} 
                            onMouseUp={() => setMostrarPinId(null)}
                            className="text-[10px] opacity-40 hover:opacity-100"
                          >👁️</button>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => { setEditando(emp); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-all">✎</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-[10px] table-fixed border-collapse">
                <thead className="bg-[#1e293b] uppercase text-slate-400 font-black sticky top-0 z-30 shadow-md">
                  <tr>
                    <th className="p-4">Empleado</th>
                    <th className="p-4 w-24">Tipo</th>
                    <th className="p-4 w-28">Modo</th>
                    <th className="p-4">Autorizado por</th>
                    <th className="p-4 w-32">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movimientos
                    .filter(m => {
                      const matchesBusqueda = m.nombre_empleado.toLowerCase().includes(busquedaMov.toLowerCase()) || 
                                              m.detalles.toLowerCase().includes(busquedaMov.toLowerCase());
                      const matchesFecha = filtroFecha ? new Date(m.fecha_hora).toISOString().split('T')[0] === filtroFecha : true;
                      return matchesBusqueda && matchesFecha;
                    })
                    .map((mov, index, array) => {
                      const info = parseDetalles(mov.detalles || '');
                      const fechaActual = new Date(mov.fecha_hora).toLocaleDateString();
                      const fechaPrevia = index > 0 ? new Date(array[index - 1].fecha_hora).toLocaleDateString() : null;
                      const esNuevoDia = fechaActual !== fechaPrevia;

                      return (
                        <>
                          {esNuevoDia && (
                            <tr key={`date-${mov.id}`} className="bg-white/[0.03]">
                              <td colSpan={5} className="p-2 text-center text-[9px] font-black text-emerald-500 uppercase tracking-[0.5em]">
                                🗓️ {fechaActual}
                              </td>
                            </tr>
                          )}
                          <tr key={mov.id} className="hover:bg-white/[0.01]">
                            <td className="p-4 font-bold text-slate-200">{mov.nombre_empleado}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-md font-black text-[8px] ${mov.tipo_movimiento === 'entrada' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                {mov.tipo_movimiento?.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-4 uppercase text-slate-400 font-black text-[9px]">{info.modo}</td>
                            <td className="p-4 text-blue-400 font-bold">{info.autoriza}</td>
                            <td className="p-4 text-slate-500 font-mono text-[9px]">
                              {new Date(mov.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        </>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}