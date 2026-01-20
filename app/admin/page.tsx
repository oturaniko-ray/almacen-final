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
  }, []);

  async function fetchEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }

  async function fetchMovimientos() {
    const { data } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
    if (data) setMovimientos(data);
  }

  const mapearRol = (r: string) => (r === 'admin' || r === 'administrador') ? 'administrador' : r;

  async function guardarEmpleado() {
    if (!nuevo.nombre || !nuevo.documento_id || !nuevo.pin_seguridad) return;
    const { error } = await supabase.from('empleados').insert([{ ...nuevo, rol: mapearRol(nuevo.rol) }]);
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

  // Pantalla de Menú Principal (Botones Grandes)
  if (vista === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-black uppercase italic tracking-tighter text-blue-500 mb-10">Panel Administrativo</h1>
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setVista('empleados')} className="w-full p-8 bg-[#0f172a] border border-white/5 rounded-[30px] font-black uppercase italic hover:bg-blue-600 transition-all shadow-2xl">
            👥 Gestión de Empleados
          </button>
          <button onClick={() => setVista('movimientos')} className="w-full p-8 bg-[#0f172a] border border-white/5 rounded-[30px] font-black uppercase italic hover:bg-blue-600 transition-all shadow-2xl">
            🕒 Historial de Movimientos
          </button>
          <button onClick={() => router.push('/')} className="w-full p-4 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
            ← Salir al Inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white font-sans flex flex-col">
      {/* CABECERA REDUCIDA PARA MÓVIL */}
      <div className="sticky top-0 z-50 bg-[#050a14] p-4 border-b border-white/5 shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button onClick={() => setVista('menu')} className="bg-slate-800 px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-white/5">← Menú</button>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-500">
            {vista === 'empleados' ? 'Gestión de Personal' : 'Historial de Accesos'}
          </h2>
          <button onClick={vista === 'empleados' ? fetchEmpleados : fetchMovimientos} className="bg-blue-600/10 text-blue-500 px-4 py-2 rounded-xl text-[9px] font-black">🔄</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {vista === 'empleados' ? (
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Formulario Compacto */}
            <div className="bg-[#0f172a] p-4 rounded-[25px] border border-white/5 shadow-2xl space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Nombre" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none" value={editando ? editando.nombre : nuevo.nombre} onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} />
                <input type="text" placeholder="ID" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none" value={editando ? editando.documento_id : nuevo.documento_id} onChange={e => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} />
                <input type="email" placeholder="Correo" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none" value={editando ? editando.email : nuevo.email} onChange={e => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} />
                <input type="text" placeholder="PIN" className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] outline-none" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} />
              </div>
              <div className="flex gap-2">
                <select className="flex-1 bg-slate-950 p-3 rounded-xl border border-white/5 text-[11px] font-bold" value={editando ? editando.rol : nuevo.rol} onChange={e => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
                  <option value="empleado">Empleado</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="administrador">Admin</option>
                </select>
                <button onClick={editando ? actualizarEmpleado : guardarEmpleado} className="flex-1 bg-blue-600 rounded-xl font-black uppercase italic text-[10px]">
                  {editando ? 'Actualizar' : 'Registrar'}
                </button>
              </div>
            </div>

            {/* Tabla con Scroll Lateral para Móvil */}
            <div className="bg-[#0f172a] rounded-[25px] border border-white/5 overflow-x-auto shadow-2xl">
              <table className="w-full text-left text-[10px] min-w-[500px]">
                <thead className="bg-white/5 uppercase text-slate-500 font-black">
                  <tr>
                    <th className="p-3">Status</th>
                    <th className="p-3">Empleado</th>
                    <th className="p-3">ID/PIN</th>
                    <th className="p-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {empleados.map(emp => (
                    <tr key={emp.id}>
                      <td className="p-3"><div className={`w-2 h-2 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></div></td>
                      <td className="p-3">
                        <p className="font-bold">{emp.nombre}</p>
                        <p className="text-[9px] text-slate-500">{emp.email}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-mono text-blue-400">{emp.documento_id}</p>
                        <p className="text-slate-500">P:{emp.pin_seguridad}</p>
                      </td>
                      <td className="p-3 text-right flex justify-end gap-2">
                        <button onClick={() => setEditando(emp)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">✎</button>
                        <button onClick={async () => { await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id); fetchEmpleados(); }} className={`px-2 py-1 rounded-lg font-black text-[8px] ${emp.activo ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{emp.activo ? 'OFF' : 'ON'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <div className="bg-[#0f172a] rounded-[25px] border border-white/5 overflow-x-auto shadow-2xl">
              <table className="w-full text-left text-[10px] min-w-[450px]">
                <thead className="bg-white/5 uppercase text-slate-500 font-black">
                  <tr>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Fecha/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movimientos.map(mov => (
                    <tr key={mov.id}>
                      <td className="p-3 font-bold">{mov.nombre_empleado || '---'}</td>
                      <td className="p-3 uppercase">
                        <span className={`px-2 py-1 rounded-md ${mov.tipo_movimiento === 'entrada' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>{mov.tipo_movimiento}</span>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[9px]">
                        {mov.fecha_hora ? new Date(mov.fecha_hora).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '---'}
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