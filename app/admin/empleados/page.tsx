'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionEmpleados() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  // MODIFICACIÓN: Se añade estado 'filtro' para la barra de búsqueda solicitada
  const [filtro, setFiltro] = useState(''); 
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    setUser(JSON.parse(sessionData));
    fetchEmpleados();
  }, [router]);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = editando || nuevo;
    const { error } = await supabase.from('empleados').upsert([payload]);
    
    if (!error) {
      setEditando(null);
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
      fetchEmpleados();
    }
  };

  const toggleEstado = async (emp: any) => {
    const { error } = await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id);
    if (!error) fetchEmpleados();
  };

  // MODIFICACIÓN: Lógica de filtrado reactiva para la barra de búsqueda
  const empleadosFiltrados = empleados.filter(emp => 
    emp.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    emp.documento_id.includes(filtro)
  );

  return (
    <main className="min-h-screen bg-[#050a14] p-4 md:p-12 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">Gestión de <span className="text-blue-500">Personal</span></h2>
          <div className="flex gap-4">
            {/* MODIFICACIÓN: Agregar barra de búsqueda que filtra por caracteres introducidos */}
            <input 
              type="text" 
              placeholder="BUSCAR EMPLEADO..." 
              className="bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500 w-64"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
            <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700">← Volver</button>
          </div>
        </header>

        {/* MODIFICACIÓN: Se añade 'sticky top-4 z-20' para que el membrete de datos quede fijo */}
        <div className="sticky top-4 z-20 bg-[#0f172a] p-8 rounded-[35px] border border-white/5 mb-12 shadow-2xl">
          <h3 className="text-sm font-black uppercase text-blue-500 mb-6 tracking-[0.3em]">
            {editando ? 'Modificar Ficha' : 'Registro de Nuevo Personal'}
          </h3>
          <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <input placeholder="Nombre Completo" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs" value={editando?.nombre || nuevo.nombre} onChange={e => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} required />
            <input placeholder="Documento ID" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs" value={editando?.documento_id || nuevo.documento_id} onChange={e => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} required />
            <input placeholder="Email" type="email" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs" value={editando?.email || nuevo.email} onChange={e => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} required />
            <input placeholder="PIN (4-6 dígitos)" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs" value={editando?.pin_seguridad || nuevo.pin_seguridad} onChange={e => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            
            <select 
              className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs text-slate-400"
              value={editando?.rol || nuevo.rol}
              onChange={e => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}
            >
              <option value="empleado">Empleado</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </select>

            <button type="submit" className="bg-blue-600 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all">
              {editando ? 'Actualizar' : 'Registrar'}
            </button>
          </form>
          {editando && <button onClick={() => setEditando(null)} className="mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cancelar Edición</button>}
        </div>

        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <th className="py-6 px-8">Personal</th>
                <th className="py-6 px-4">Rol</th>
                <th className="py-6 px-4">Credenciales</th>
                <th className="py-6 px-4 text-center">Estado</th>
                <th className="py-6 px-8 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {empleadosFiltrados.map((emp) => (
                <tr key={emp.id} className="group hover:bg-white/[0.01] transition-all">
                  <td className="py-5 px-8">
                    <p className="font-bold text-sm uppercase">{emp.nombre}</p>
                    {/* MODIFICACIÓN: Cambiar el color del documento en las filas a amarillo (text-yellow-400) */}
                    <span className="text-[10px] font-black text-yellow-400/60 uppercase tracking-widest">{emp.documento_id}</span>
                  </td>
                  <td className="py-5 px-4">
                    <span className="text-[10px] font-black uppercase bg-slate-800 px-3 py-1 rounded-md text-slate-300">
                      {emp.rol}
                    </span>
                  </td>
                  <td className="py-5 px-4">
                    <p className="text-xs text-slate-400">{emp.email}</p>
                    <div className="relative h-4 overflow-hidden">
                      <p className="text-[10px] font-black text-blue-500 uppercase transition-all duration-300 group-hover:-translate-y-full">PIN OCULTO</p>
                      {/* MODIFICACIÓN: Cambiar color de PIN a amarillo (text-yellow-400) al pasar el mouse */}
                      <p className="text-[10px] font-black text-yellow-400 uppercase transition-all duration-300 translate-y-full group-hover:translate-y-0 absolute top-0">PIN: {emp.pin_seguridad}</p>
                    </div>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <button onClick={() => toggleEstado(emp)} className={`px-5 py-1.5 rounded-lg font-black text-[9px] uppercase transition-all shadow-lg ${emp.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white' : 'bg-red-600 text-white shadow-red-900/40 hover:bg-red-500'}`}>
                      {emp.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="py-5 px-8 text-center">
                    {/* MODIFICACIÓN: Se agrega emoji de lápiz ✏️ al lado de "EDITAR" */}
                    <button onClick={() => setEditando(emp)} className="text-blue-500 hover:text-blue-400 font-black text-[10px] uppercase tracking-widest p-2 flex items-center justify-center gap-2 mx-auto">
                      <span>✏️</span> EDITAR
                    </button>
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