'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionEmpleados() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    
    // 🛡️ REVISIÓN DE ACCESO: Permitir entrada a administradores
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador'].includes(currentUser.rol.toLowerCase())) {
      router.replace('/');
      return;
    }
    setUser(currentUser);
    fetchEmpleados();

    const channel = supabase.channel('realtime-gestion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchEmpleados())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editando) {
      await supabase.from('empleados').update(nuevo).eq('id', editando.id);
    } else {
      await supabase.from('empleados').insert([nuevo]);
    }
    setEditando(null);
    setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
    fetchEmpleados();
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white">
      <div className="max-w-7xl mx-auto">
        {/* MENÚ SUPERIOR FIJO */}
        <div className="sticky top-0 z-50 bg-[#0f172a] p-8 rounded-[35px] border border-white/5 mb-12 shadow-2xl">
          <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <input placeholder="NOMBRE" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs uppercase" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value.toUpperCase()})} required />
            <input placeholder="DOCUMENTO" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
            <input placeholder="EMAIL" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value})} required />
            <input placeholder="PIN" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            <select className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
              <option value="empleado">EMPLEADO</option>
              <option value="supervisor">SUPERVISOR</option>
              <option value="admin">ADMINISTRADOR</option>
            </select>
            <button type="submit" className="bg-blue-600 rounded-xl font-black text-xs uppercase">{editando ? 'Actualizar' : 'Registrar'}</button>
          </form>
        </div>

        {/* TABLA ORDENADA */}
        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-500 uppercase border-b border-white/5">
                <th className="py-6 px-8">Nombre / Documento</th>
                <th className="py-6 px-4">Correo / PIN</th>
                <th className="py-6 px-4">Rol</th>
                <th className="py-6 px-4 text-center">Estado</th>
                <th className="py-6 px-8 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp) => (
                <tr key={emp.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                  <td className="py-5 px-8">
                    <div className="flex items-center gap-2">
                      <p className="font-bold uppercase">{emp.nombre}</p>
                      {/* Punto parpadeante */}
                      <span className={`w-2 h-2 rounded-full ${emp.en_almacen ? 'bg-emerald-500 animate-pulse' : 'bg-white/10'}`}></span>
                    </div>
                    {/* Documento: Blanco, sin bold, +20% tamaño */}
                    <p className="text-[14.4px] font-normal text-white uppercase">{emp.documento_id}</p>
                  </td>
                  <td className="py-5 px-4">
                    <p className="text-xs text-slate-400">{emp.email}</p>
                    {/* PIN Oculto Hover */}
                    <div className="relative h-4 overflow-hidden group cursor-pointer">
                      <p className="text-[10px] font-black text-blue-500 group-hover:-translate-y-full transition-all">PIN OCULTO</p>
                      <p className="text-[10px] font-black text-yellow-400 absolute top-0 translate-y-full group-hover:translate-y-0 transition-all italic">PIN: {emp.pin_seguridad}</p>
                    </div>
                  </td>
                  <td className="py-5 px-4 text-[10px] font-black uppercase text-slate-400">{emp.rol}</td>
                  <td className="py-5 px-4 text-center">
                    <span className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase ${emp.activo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {emp.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-5 px-8 text-center">
                    <button onClick={() => { setEditando(emp); setNuevo(emp); }} className="text-blue-500 font-black text-[10px] uppercase">✏️ Editar</button>
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