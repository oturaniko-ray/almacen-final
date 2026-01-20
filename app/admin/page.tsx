'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [vista, setVista] = useState<'empleados' | 'movimientos'>('empleados');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
  const router = useRouter();

  useEffect(() => {
    fetchEmpleados();
    fetchMovimientos();
  }, []);

  async function fetchEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }

  async function fetchMovimientos() {
    const { data } = await supabase.from('registros_acceso').select('*').order('creado_en', { ascending: false }).limit(100);
    if (data) setMovimientos(data);
  }

  const mapearRol = (r: string) => (r === 'administrador' || r === 'admin') ? 'admin' : r;

  async function guardarEmpleado() {
    if (!nuevo.nombre || !nuevo.documento_id || !nuevo.pin_seguridad) return;
    const { error } = await supabase.from('empleados').insert([{ ...nuevo, rol: mapearRol(nuevo.rol) }]);
    if (!error) {
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
      fetchEmpleados();
    } else { alert("Error: " + error.message); }
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

  async function toggleEstado(id: string, actual: boolean) {
    await supabase.from('empleados').update({ activo: !actual }).eq('id', id);
    fetchEmpleados();
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white font-sans flex flex-col">
      {/* CABECERA FIJA */}
      <div className="sticky top-0 z-50 bg-[#050a14] p-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-blue-500">Panel Administrativo</h1>
          <button onClick={() => router.push('/')} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5">← Volver</button>
        </div>

        {/* MENÚ DE NAVEGACIÓN (BOTONES DE SEPARACIÓN) */}
        <div className="max-w-7xl mx-auto flex gap-4 mb-6">
          <button 
            onClick={() => setVista('empleados')} 
            className={`flex-1 p-4 rounded-2xl font-black uppercase italic transition-all ${vista === 'empleados' ? 'bg-blue-600 shadow-lg shadow-blue-900/20' : 'bg-[#0f172a] border border-white/5 text-slate-500'}`}
          >
            👥 Gestión de Empleados
          </button>
          <button 
            onClick={() => setVista('movimientos')} 
            className={`flex-1 p-4 rounded-2xl font-black uppercase italic transition-all ${vista === 'movimientos' ? 'bg-blue-600 shadow-lg shadow-blue-900/20' : 'bg-[#0f172a] border border-white/5 text-slate-500'}`}
          >
            🕒 Historial de Movimientos
          </button>
        </div>

        {/* FORMULARIO ESTÁTICO (SOLO VISIBLE EN GESTIÓN) */}
        {vista === 'empleados' && (
          <div className="max-w-7xl mx-auto bg-[#0f172a] p-6 rounded-[30px] border border-white/5 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <input type="text" placeholder="Nombre" className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm" value={editando ? editando.nombre : nuevo.nombre} onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} />
              <input type="text" placeholder="ID Documento" className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm" value={editando ? editando.documento_id : nuevo.documento_id} onChange={e => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} />
              <input type="email" placeholder="Correo" className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm" value={editando ? editando.email : nuevo.email} onChange={e => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} />
              <input type="text" placeholder="PIN" className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} />
              <select className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm font-bold" value={editando ? editando.rol : nuevo.rol} onChange={e => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="administrador">Administrador</option>
              </select>
              <button onClick={editando ? actualizarEmpleado : guardarEmpleado} className="bg-blue-600 rounded-xl font-black uppercase italic text-xs">
                {editando ? 'Actualizar' : 'Registrar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ÁREA DE CONTENIDO SCROLLABLE */}
      <div className="p-6 max-w-7xl mx-auto w-full overflow-y-auto">
        
        {vista === 'empleados' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Lista de Personal</h2>
              <button onClick={fetchEmpleados} className="text-[10px] bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg border border-blue-500/20">🔄 Actualizar Lista</button>
            </div>
            <div className="bg-[#0f172a] rounded-[35px] border border-white/5 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 uppercase text-slate-500 font-black">
                  <tr>
                    <th className="p-4">Status</th>
                    <th className="p-4">Empleado / Correo</th>
                    <th className="p-4">ID / PIN</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {empleados.map(emp => (
                    <tr key={emp.id} className="hover:bg-white/[0.02]">
                      <td className="p-4">
                        <div className={`w-3 h-3 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></div>
                      </td>
                      <td className="p-4">
                        <p className="font-bold">{emp.nombre}</p>
                        <p className="text-[10px] text-slate-500">{emp.email}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-mono text-blue-400">{emp.documento_id}</p>
                        <p className="font-mono text-slate-500">PIN: {emp.pin_seguridad}</p>
                      </td>
                      <td className="p-4 uppercase text-[9px] font-black">{emp.rol}</td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        <button onClick={() => setEditando(emp)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">✎</button>
                        <button 
                          onClick={() => toggleEstado(emp.id, emp.activo)} 
                          className={`px-3 py-1 rounded-full font-black text-[9px] ${emp.activo ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}
                        >
                          {emp.activo ? 'DESACTIVAR' : 'ACTIVAR'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Últimos Movimientos</h2>
              <button onClick={fetchMovimientos} className="text-[10px] bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg border border-blue-500/20">🔄 Actualizar Historial</button>
            </div>
            <div className="bg-[#0f172a] rounded-[35px] border border-white/5 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 uppercase text-slate-500 font-black">
                  <tr>
                    <th className="p-4">Empleado</th>
                    <th className="p-4">Acción</th>
                    <th className="p-4">Detalles / Autorización</th>
                    <th className="p-4">Fecha y Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movimientos.map(mov => (
                    <tr key={mov.id}>
                      <td className="p-4 font-bold">{mov.nombre_empleado}</td>
                      <td className="p-4 uppercase">
                        <span className={`px-2 py-1 rounded-md font-black ${mov.tipo_movimiento === 'entrada' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                          {mov.tipo_movimiento}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 text-[10px]">{mov.detalles}</td>
                      <td className="p-4 text-slate-500 font-mono">{new Date(mov.creado_en).toLocaleString()}</td>
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