'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [vista, setVista] = useState<'menu' | 'empleados' | 'movimientos'>('menu');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
  const router = useRouter();

  useEffect(() => {
    fetchEmpleados();
    fetchMovimientos();

    // ⚡ TIEMPO REAL OPTIMIZADO:
    // Asegúrate en tu Dashboard de Supabase: Database -> Replication -> 'public' -> 'empleados' (Habilitar)
    const canalPersonal = supabase
      .channel('realtime-presencia')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'empleados' }, 
        (payload) => {
          // Actualización selectiva para evitar parpadeos en la UI
          setEmpleados(actuales => 
            actuales.map(emp => emp.id === payload.new.id ? { ...emp, ...payload.new } : emp)
          );
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registros_acceso' },
        () => {
          // Si hay un nuevo movimiento, refrescamos la lista de movimientos
          fetchMovimientos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalPersonal);
    };
  }, []);

  async function fetchEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }

  async function fetchMovimientos() {
    const { data } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false }).limit(50);
    if (data) setMovimientos(data);
  }

  const mapearRol = (r: string) => (r === 'admin' || r === 'administrador') ? 'administrador' : r;

  async function guardarEmpleado() {
    if (!nuevo.nombre || !nuevo.documento_id || !nuevo.pin_seguridad) return;
    const { error } = await supabase.from('empleados').insert([{ ...nuevo, rol: mapearRol(nuevo.rol), en_almacen: false, activo: true }]);
    if (!error) {
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
      fetchEmpleados();
    }
  }

  async function actualizarEmpleado() {
    if (!editando) return;
    const { error } = await supabase.from('empleados').update({
      nombre: editando.nombre,
      documento_id: editando.documento_id,
      email: editando.email,
      pin_seguridad: editando.pin_seguridad,
      rol: mapearRol(editando.rol)
    }).eq('id', editando.id);
    if (!error) { setEditando(null); fetchEmpleados(); }
  }

  // VISTA PRINCIPAL
  if (vista === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-black uppercase italic tracking-tighter text-blue-500 mb-10 text-center">
          Panel Administrativo <br/> <span className="text-[10px] text-slate-500 not-italic tracking-[0.4em]">Control Maestro</span>
        </h1>
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setVista('empleados')} className="w-full p-8 bg-[#0f172a] border border-white/5 rounded-[30px] font-black uppercase italic hover:bg-blue-600 transition-all shadow-2xl group">
             <span className="block text-2xl mb-2 group-hover:scale-110 transition-transform">👥</span>
             Gestión de Personal
          </button>
          
          <button onClick={() => setVista('movimientos')} className="w-full p-8 bg-[#0f172a] border border-white/5 rounded-[30px] font-black uppercase italic hover:bg-blue-600 transition-all shadow-2xl group">
             <span className="block text-2xl mb-2 group-hover:scale-110 transition-transform">🕒</span>
             Historial de Accesos
          </button>

          <div className="pt-6 flex flex-col items-center gap-4">
            <button onClick={() => router.push('/')} className="w-full p-4 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 hover:text-white transition-all">
              ← Volver al Menú
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-[#050a14] text-white font-sans flex flex-col overflow-hidden">
      <div className="flex-none bg-[#050a14] p-4 border-b border-white/5 shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-4">
          <button onClick={() => {setVista('menu'); setEditando(null);}} className="bg-slate-800 px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-white/5">← Volver</button>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-500">
            {vista === 'empleados' ? 'Presencia en Tiempo Real' : 'Historial de Accesos'}
          </h2>
          <button onClick={vista === 'empleados' ? fetchEmpleados : fetchMovimientos} className="bg-blue-600/10 text-blue-500 px-4 py-2 rounded-xl text-[9px] font-black">🔄</button>
        </div>

        {vista === 'empleados' && (
          <div className="max-w-7xl mx-auto bg-[#0f172a] p-4 rounded-[25px] border border-white/5 shadow-2xl space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Nombre Completo" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.nombre : nuevo.nombre} onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} />
              <input type="text" placeholder="DNI / Documento" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none focus:border-blue-500" value={editando ? editando.documento_id : nuevo.documento_id} onChange={e => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} />
              <input type="email" placeholder="Correo" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none" value={editando ? editando.email : nuevo.email} onChange={e => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} />
              <input type="text" placeholder="PIN Seguridad" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} />
            </div>
            <div className="flex gap-2">
              <select className="flex-1 bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] font-bold" value={editando ? editando.rol : nuevo.rol} onChange={e => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="administrador">Administrador</option>
              </select>
              <button onClick={editando ? actualizarEmpleado : guardarEmpleado} className="flex-1 bg-blue-600 rounded-xl font-black uppercase italic text-[10px] hover:bg-blue-500 transition-colors">
                {editando ? 'Confirmar Cambios' : 'Registrar Nuevo'}
              </button>
              {editando && <button onClick={() => setEditando(null)} className="px-4 bg-red-600/10 text-red-500 rounded-xl font-black uppercase text-[10px]">✕</button>}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {vista === 'empleados' ? (
          <div className="max-w-7xl mx-auto">
            <div className="bg-[#0f172a] rounded-[25px] border border-white/5 overflow-x-auto shadow-2xl">
              <table className="w-full text-left text-[10px] min-w-[600px]">
                <thead className="bg-white/5 uppercase text-slate-500 font-black">
                  <tr>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Empleado</th>
                    <th className="p-3">Rol</th>
                    <th className="p-3">ID / PIN</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {empleados.map(emp => (
                    <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-3 h-3 rounded-full transition-all duration-700 ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}></div>
                          <span className={`text-[7px] font-black uppercase ${emp.en_almacen ? 'text-emerald-500' : 'text-red-500'}`}>
                            {emp.en_almacen ? 'Presente' : 'Ausente'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className={`font-bold transition-colors ${emp.en_almacen ? 'text-white' : 'text-slate-400'}`}>{emp.nombre}</p>
                        <p className="text-[9px] text-slate-500">{emp.email}</p>
                      </td>
                      <td className="p-3 uppercase font-black text-slate-400">{emp.rol}</td>
                      <td className="p-3">
                        <p className="font-mono text-blue-400">{emp.documento_id}</p>
                        <p className="text-slate-500 text-[8px]">PIN: {emp.pin_seguridad}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditando(emp)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-all">✎</button>
                          <button onClick={async () => { await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id); fetchEmpleados(); }} className={`px-2 py-1 rounded-lg font-black text-[8px] ${emp.activo ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {emp.activo ? 'BAJA' : 'ALTA'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {/* HISTORIAL... (Se mantiene igual pero con fetch automático por canal) */}
            <div className="bg-[#0f172a] rounded-[25px] border border-white/5 overflow-x-auto shadow-2xl">
              <table className="w-full text-left text-[10px] min-w-[550px]">
                <thead className="bg-white/5 uppercase text-slate-500 font-black">
                  <tr>
                    <th className="p-3">Empleado</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Validación / Supervisor</th>
                    <th className="p-3">Fecha/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movimientos.map(mov => (
                    <tr key={mov.id}>
                      <td className="p-3 font-bold text-slate-200">{mov.nombre_empleado}</td>
                      <td className="p-3 uppercase">
                        <span className={`px-2 py-1 rounded-md font-black ${mov.tipo_movimiento === 'entrada' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                          {movin_movimiento === 'entrada' ? 'ENTRADA' : 'SALIDA'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="text-blue-400 font-black uppercase text-[8px]">{mov.detalles?.split(': ')[0]}</span>
                          <span className="text-slate-500 italic text-[9px]">{mov.detalles?.split(': ')[1] || 'Acceso Directo'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[9px]">
                        {new Date(mov.fecha_hora).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}