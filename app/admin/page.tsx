'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: emp } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (emp) setEmpleados(emp);
    
    const { data: mov } = await supabase.from('registros_acceso').select('*').order('creado_en', { ascending: false }).limit(50);
    if (mov) setMovimientos(mov);
  }

  const mapearRol = (r: string) => (r === 'administrador' || r === 'admin') ? 'admin' : r;

  async function guardar() {
    const { error } = await supabase.from('empleados').insert([{ ...nuevo, rol: mapearRol(nuevo.rol) }]);
    if (!error) { setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' }); fetchData(); }
  }

  async function actualizar() {
    const { error } = await supabase.from('empleados').update({ ...editando, rol: mapearRol(editando.rol) }).eq('id', editando.id);
    if (!error) { setEditando(null); fetchData(); }
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white font-sans flex flex-col">
      {/* CABECERA ESTÁTICA */}
      <div className="sticky top-0 z-50 bg-[#050a14]/80 backdrop-blur-xl p-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-blue-500">Panel Administrativo</h1>
          <button onClick={() => router.push('/')} className="bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5">← Volver</button>
        </div>

        {/* FORMULARIO ESTÁTICO */}
        <div className="max-w-7xl mx-auto bg-[#0f172a] p-6 rounded-[30px] border border-white/5 shadow-2xl">
          <p className="text-[10px] font-black uppercase mb-4 text-blue-400">{editando ? '📝 Editando Empleado' : '✨ Registrar Nuevo Empleado'}</p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input type="text" placeholder="Nombre" className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm" value={editando ? editando.nombre : nuevo.nombre} onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} />
            <input type="text" placeholder="ID Documento" className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm" value={editando ? editando.documento_id : nuevo.documento_id} onChange={e => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} />
            <input type="text" placeholder="PIN" className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} />
            <select className="bg-slate-950 p-3 rounded-xl border border-white/5 outline-none text-sm font-bold" value={editando ? editando.rol : nuevo.rol} onChange={e => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
              <option value="empleado">Empleado</option>
              <option value="supervisor">Supervisor</option>
              <option value="administrador">Administrador</option>
            </select>
            <button onClick={editando ? actualizar : guardar} className="bg-blue-600 rounded-xl font-black uppercase italic text-xs hover:bg-blue-500 transition-all">
              {editando ? 'Guardar Cambios' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO SCROLLABLE */}
      <div className="p-6 max-w-7xl mx-auto w-full space-y-10 overflow-y-auto">
        
        {/* SECCIÓN 1: GESTIÓN DE EMPLEADOS */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-[0.3em] mb-4 text-slate-500">Gestión de Empleados</h2>
          <div className="bg-[#0f172a] rounded-[35px] border border-white/5 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 uppercase text-slate-500 font-black">
                <tr>
                  <th className="p-4">Status</th>
                  <th className="p-4">Nombre</th>
                  <th className="p-4">ID</th>
                  <th className="p-4">PIN</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleados.map(emp => (
                  <tr key={emp.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div className={`w-2 h-2 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></div>
                    </td>
                    <td className="p-4 font-bold">{emp.nombre}</td>
                    <td className="p-4 font-mono text-slate-400">{emp.documento_id}</td>
                    <td className="p-4 font-mono text-blue-400">{emp.pin_seguridad}</td>
                    <td className="p-4 uppercase text-[9px] font-black">{emp.rol}</td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      <button onClick={() => setEditando(emp)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg text-lg">✎</button>
                      <button onClick={async () => { await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id); fetchData(); }} className={`px-3 py-1 rounded-full font-black ${emp.activo ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {emp.activo ? 'BLOQUEAR' : 'HABILITAR'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECCIÓN 2: MOVIMIENTOS DE ACCESO */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-[0.3em] mb-4 text-slate-500">Historial de Movimientos</h2>
          <div className="bg-[#0f172a] rounded-[35px] border border-white/5 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 uppercase text-slate-500 font-black">
                <tr>
                  <th className="p-4">Empleado</th>
                  <th className="p-4">Acción</th>
                  <th className="p-4">Detalles</th>
                  <th className="p-4">Fecha/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {movimientos.map(mov => (
                  <tr key={mov.id}>
                    <td className="p-4 font-bold">{mov.nombre_empleado}</td>
                    <td className="p-4 uppercase">
                      <span className={`px-2 py-1 rounded-md font-black ${mov.tipo_movimiento === 'entrada' ? 'text-emerald-500' : 'text-red-500'}`}>
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
        </section>
      </div>
    </main>
  );
}