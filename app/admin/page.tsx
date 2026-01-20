'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPanel() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });

  useEffect(() => {
    fetchEmpleados();
  }, []);

  async function fetchEmpleados() {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }

  async function agregarEmpleado() {
    if (!nuevo.nombre || !nuevo.documento_id || !nuevo.pin_seguridad) return;
    // Aseguramos que el rol vaya exactamente como la base de datos lo espera
    const { error } = await supabase.from('empleados').insert([nuevo]);
    if (!error) {
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado' });
      fetchEmpleados();
    } else {
      alert("Error al agregar: " + error.message);
    }
  }

  async function toggleEstado(id: string, actual: boolean) {
    await supabase.from('empleados').update({ activo: !actual }).eq('id', id);
    fetchEmpleados();
  }

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <h1 className="text-3xl font-black mb-8 italic uppercase tracking-tighter text-blue-500">Gestión de Personal</h1>
      
      {/* Formulario */}
      <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5 mb-8 grid grid-cols-1 md:grid-cols-5 gap-4">
        <input type="text" placeholder="Nombre" className="bg-slate-950 p-3 rounded-xl border border-white/10 outline-none" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
        <input type="text" placeholder="ID Documento" className="bg-slate-950 p-3 rounded-xl border border-white/10 outline-none" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} />
        <input type="email" placeholder="Email" className="bg-slate-950 p-3 rounded-xl border border-white/10 outline-none" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value})} />
        <input type="text" placeholder="PIN" className="bg-slate-950 p-3 rounded-xl border border-white/10 outline-none" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} />
        <select className="bg-slate-950 p-3 rounded-xl border border-white/10 outline-none" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
          <option value="empleado">Empleado</option>
          <option value="supervisor">Supervisor</option>
          <option value="administrador">Administrador</option>
        </select>
        <button onClick={agregarEmpleado} className="md:col-span-5 bg-blue-600 p-4 rounded-xl font-black uppercase italic hover:bg-blue-500 transition-all">Registrar Nuevo Usuario</button>
      </div>

      {/* Tabla */}
      <div className="bg-[#0f172a] rounded-[30px] border border-white/5 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-4">Estado</th>
              <th className="p-4">Nombre</th>
              <th className="p-4">Rol</th>
              <th className="p-4">Ubicación</th>
              <th className="p-4">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {empleados.map(emp => (
              <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4">
                   {/* Lógica de punto: Verde si en_almacen es true, Rojo si es false */}
                  <div className={`w-3 h-3 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}></div>
                </td>
                <td className="p-4 font-bold">{emp.nombre}</td>
                <td className="p-4 uppercase text-[10px] font-black text-blue-400">{emp.rol}</td>
                <td className="p-4 text-xs text-slate-400">{emp.en_almacen ? 'DENTRO' : 'FUERA'}</td>
                <td className="p-4">
                  <button onClick={() => toggleEstado(emp.id, emp.activo)} className={`px-4 py-1 rounded-full text-[10px] font-bold ${emp.activo ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {emp.activo ? 'DESACTIVAR' : 'ACTIVAR'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}