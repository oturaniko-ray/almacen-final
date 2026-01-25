'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionEmpleados() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
  const router = useRouter();

  useEffect(() => { fetchEmpleados(); }, []);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = editando || nuevo;
    const { error } = await supabase.from('empleados').upsert([payload]);
    if (!error) { setEditando(null); setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true }); fetchEmpleados(); }
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-black uppercase tracking-tighter">GESTIÓN <span className="text-blue-500">EMPLEADOS</span></h1>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2">CONFIGURACIÓN DE ACCESO Y ROLES</p>
      </header>

      <section className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 mb-10 max-w-5xl mx-auto shadow-2xl">
        <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <input className="bg-[#050a14] p-4 rounded-2xl border border-white/10 font-black uppercase text-[10px] outline-none focus:border-blue-500" placeholder="NOMBRE COMPLETO" value={editando ? editando.nombre : nuevo.nombre} onChange={(e) => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} />
          <input className="bg-[#050a14] p-4 rounded-2xl border border-white/10 font-black uppercase text-[10px] outline-none" placeholder="ID DOCUMENTO" value={editando ? editando.documento_id : nuevo.documento_id} onChange={(e) => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} />
          <select className="bg-[#050a14] p-4 rounded-2xl border border-white/10 font-black uppercase text-[10px] outline-none text-blue-500" value={editando ? editando.rol : nuevo.rol} onChange={(e) => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
            <option value="empleado">ROL: EMPLEADO</option>
            <option value="supervisor">ROL: SUPERVISOR</option>
            <option value="admin">ROL: ADMIN</option>
          </select>
          <input className="bg-[#050a14] p-4 rounded-2xl border border-white/10 font-black uppercase text-[10px] outline-none" placeholder="CORREO" value={editando ? editando.email : nuevo.email} onChange={(e) => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} />
          <input className="bg-[#050a14] p-4 rounded-2xl border border-white/10 font-black uppercase text-[10px] outline-none" placeholder="PIN" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={(e) => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} />
          <button className="bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">GUARDAR CAMBIOS</button>
        </form>
      </section>

      <div className="overflow-hidden rounded-[35px] border border-white/5 bg-[#0f172a] max-w-5xl mx-auto shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-white/5">
            <tr>
              <th className="p-6 font-black uppercase text-[10px] text-slate-500">EMPLEADO / ROL</th>
              <th className="p-6 font-black uppercase text-[10px] text-slate-500">IDENTIDAD</th>
              <th className="p-6 font-black uppercase text-[10px] text-slate-500 text-center">PIN SEGURIDAD</th>
              <th className="p-6 font-black uppercase text-[10px] text-slate-500 text-center">ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map(emp => (
              <tr key={emp.id} className="border-t border-white/5 hover:bg-white/[0.02] group transition-all">
                <td className="p-6">
                  <p className="font-black uppercase text-sm">{emp.nombre}</p>
                  <p className="text-[9px] font-black text-blue-500 uppercase">{emp.rol}</p>
                </td>
                <td className="p-6 font-black uppercase text-xs text-slate-400">{emp.documento_id}</td>
                <td className="p-6 text-center">
                   <span className="font-black text-xs text-blue-500 group-hover:hidden transition-all">●●●●</span>
                   <span className="font-black text-xs text-emerald-500 hidden group-hover:inline transition-all">{emp.pin_seguridad}</span>
                </td>
                <td className="p-6 text-center">
                  <button onClick={async () => { await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id); fetchEmpleados(); }} className={`px-4 py-1.5 rounded-lg font-black text-[9px] uppercase ${emp.activo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-600 text-white'}`}>
                    {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <center className="mt-10">
        <button onClick={() => router.push('/admin')} className="text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">← VOLVER AL PANEL</button>
      </center>
    </main>
  );
}