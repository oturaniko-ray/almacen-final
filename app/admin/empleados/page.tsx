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
  const [filtro, setFiltro] = useState(''); 
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    
    const currentUser = JSON.parse(sessionData);
    // Permitir acceso a admin y administrador
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

  const toggleEstado = async (emp: any) => {
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id);
    fetchEmpleados();
  };

  const empleadosFiltrados = empleados.filter(e => 
    e.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    e.documento_id.includes(filtro)
  );

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* CABECERA RESTAURADA CON DATOS DE SESIÓN */}
        <header className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">
              GESTIÓN DE <span className="text-blue-500">PERSONAL</span>
            </h1>
            {user && (
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1 w-8 bg-blue-500 rounded-full"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  SESIÓN: <span className="text-white italic">{user.nombre}</span> • <span className="text-blue-400">{user.rol}</span>
                </p>
              </div>
            )}
          </div>
          <button 
            onClick={() => router.push('/admin')} 
            className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all border border-white/5"
          >
            ← Volver
          </button>
        </header>

        {/* FORMULARIO SUPERIOR FIJO */}
        <div className="sticky top-4 z-50 bg-[#0f172a] p-8 rounded-[35px] border border-white/5 mb-12 shadow-2xl">
          <h3 className="text-[10px] font-black uppercase text-blue-500 mb-6 tracking-[0.3em]">
            {editando ? 'Modificar Registro' : 'Registro de Nuevo Personal'}
          </h3>
          <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <input placeholder="NOMBRE" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs uppercase outline-none focus:border-blue-500" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value.toUpperCase()})} required />
            <input placeholder="DOCUMENTO" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
            <input placeholder="EMAIL" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value})} required />
            <input placeholder="PIN" className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            <select className="bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
              <option value="empleado">EMPLEADO</option>
              <option value="supervisor">SUPERVISOR</option>
              <option value="admin">ADMINISTRADOR</option>
            </select>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 p-4 rounded-xl font-black text-xs uppercase transition-all shadow-lg shadow-blue-600/20">
              {editando ? 'Actualizar' : 'Registrar'}
            </button>
          </form>
          {editando && (
            <button onClick={() => { setEditando(null); setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true }); }} className="mt-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-white">Cancelar Edición</button>
          )}
        </div>

        {/* TABLA CON COLUMNAS ORDENADAS */}
        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 bg-white/[0.02]">
            <input type="text" placeholder="FILTRAR PERSONAL..." className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest" value={filtro} onChange={e => setFiltro(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                  <th className="py-6 px-8">Nombre / Documento</th>
                  <th className="py-6 px-4">Correo / PIN</th>
                  <th className="py-6 px-4 text-center">Rol</th>
                  <th className="py-6 px-4 text-center">Estado</th>
                  <th className="py-6 px-8 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="py-5 px-8">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm uppercase">{emp.nombre}</p>
                        <span className={`w-2 h-2 rounded-full ${emp.en_almacen ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-white/10'}`}></span>
                      </div>
                      <p className="text-[14.4px] font-normal text-white uppercase mt-1 tracking-wider">{emp.documento_id}</p>
                    </td>
                    <td className="py-5 px-4">
                      <p className="text-xs text-slate-400 mb-1">{emp.email}</p>
                      <div className="relative h-4 overflow-hidden group/pin w-fit cursor-help">
                        <p className="text-[10px] font-black text-blue-500 uppercase transition-all duration-300 group-hover/pin:-translate-y-full">PIN OCULTO</p>
                        <p className="text-[10px] font-black text-yellow-400 uppercase transition-all duration-300 translate-y-full group-hover/pin:translate-y-0 absolute top-0">PIN: {emp.pin_seguridad}</p>
                      </div>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <span className="text-[9px] font-black uppercase bg-slate-800 px-3 py-1 rounded-md text-slate-400">{emp.rol}</span>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <button onClick={() => toggleEstado(emp)} className={`px-5 py-1.5 rounded-lg font-black text-[9px] uppercase transition-all shadow-lg ${emp.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-600 text-white'}`}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="py-5 px-8 text-center">
                      <button onClick={() => { setEditando(emp); setNuevo(emp); }} className="text-blue-500 hover:text-blue-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors">
                        <span>✏️</span> EDITAR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}