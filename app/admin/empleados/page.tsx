'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionEmpleados() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador'].includes(currentUser.rol)) { router.replace('/'); return; }
    setUser(currentUser);
    fetchEmpleados();
  }, [router]);

  const fetchEmpleados = async () => {
    setLoading(true);
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
    setLoading(false);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = editando || nuevo;
    const { error } = await supabase.from('empleados').upsert([payload]);
    if (error) alert("Error: " + error.message);
    else {
      alert("Registro guardado");
      setEditando(null);
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
      fetchEmpleados();
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">GESTIÓN DE <span className="text-blue-500">EMPLEADOS</span></h1>
          <button onClick={() => router.push('/admin')} className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all">← Panel Admin</button>
        </header>

        {/* MODO EDICIÓN / AGREGAR FIJO */}
        <section className="bg-[#0f172a] p-8 rounded-[45px] border border-white/5 mb-8 shadow-2xl">
          <h3 className="text-[10px] font-black uppercase text-blue-500 mb-6 tracking-[0.3em] italic">
            {editando ? '⚡ Editando Registro' : '➕ Agregar Nuevo Empleado'}
          </h3>
          <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Nombre Completo</label>
              <input type="text" className="w-full bg-[#050a14] border border-white/10 p-4 rounded-[20px] text-sm outline-none focus:border-blue-500 transition-all" value={editando ? editando.nombre : nuevo.nombre} onChange={(e) => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} required />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Documento ID</label>
              <input type="text" className="w-full bg-[#050a14] border border-white/10 p-4 rounded-[20px] text-sm outline-none focus:border-blue-500 transition-all" value={editando ? editando.documento_id : nuevo.documento_id} onChange={(e) => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} required />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Email</label>
              <input type="email" className="w-full bg-[#050a14] border border-white/10 p-4 rounded-[20px] text-sm outline-none focus:border-blue-500 transition-all" value={editando ? editando.email : nuevo.email} onChange={(e) => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} required />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">PIN Seguridad</label>
              <input type="text" className="w-full bg-[#050a14] border border-white/10 p-4 rounded-[20px] text-sm font-mono outline-none focus:border-blue-500 transition-all" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={(e) => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Rol del Sistema</label>
              <select className="w-full bg-[#050a14] border border-white/10 p-4 rounded-[20px] text-sm outline-none appearance-none" value={editando ? editando.rol : nuevo.rol} onChange={(e) => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 p-4 rounded-[20px] font-black text-[10px] uppercase italic transition-all">Guardar Cambios</button>
              {editando && <button type="button" onClick={() => setEditando(null)} className="bg-red-900/40 p-4 rounded-[20px] text-[10px] font-black uppercase transition-all">X</button>}
            </div>
          </form>
        </section>

        {/* LISTADO */}
        <div className="bg-[#0f172a] rounded-[45px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                <th className="p-6">Empleado / ID</th>
                <th className="p-6">Correo</th>
                <th className="p-6">Rol</th>
                <th className="p-6">Estado</th>
                <th className="p-6">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {empleados.map(emp => (
                <tr key={emp.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-6">
                    <p className="font-bold text-sm uppercase">{emp.nombre}</p>
                    <p className="text-[9px] font-mono text-slate-500 uppercase">ID: {emp.documento_id}</p>
                  </td>
                  <td className="p-6 text-xs text-slate-400 font-mono italic">{emp.email}</td>
                  <td className="p-6"><span className="text-[10px] font-black uppercase italic text-blue-400 bg-blue-400/5 px-3 py-1 rounded-md border border-blue-400/10">{emp.rol}</span></td>
                  <td className="p-6">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${emp.activo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td className="p-6">
                    <button onClick={() => setEditando(emp)} className="text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors underline decoration-blue-500 underline-offset-4">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}