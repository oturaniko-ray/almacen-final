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
  const [config, setConfig] = useState<any>({ empresa_nombre: 'SISTEMA RAY', timer_inactividad: '120000' });
  const [nuevo, setNuevo] = useState({ 
    nombre: '', 
    documento_id: '', 
    email: '', 
    pin_seguridad: '', 
    rol: 'empleado', 
    activo: true,
    permiso_reportes: false 
  });
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    
    const currentUser = JSON.parse(sessionData);
    // Acceso permitido a admin, administrador y técnico
    if (!['admin', 'administrador', 'tecnico'].includes(currentUser.rol.toLowerCase())) {
      router.replace('/');
      return;
    }
    setUser(currentUser);
    fetchConfig();
    fetchEmpleados();

    const channel = supabase.channel('realtime-gestion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchEmpleados())
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  // Lógica de Inactividad Dinámica (Programable desde Consola)
  useEffect(() => {
    if (!user) return;
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.removeItem('user_session');
        router.replace('/');
      }, parseInt(config.timer_inactividad));
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [user, config.timer_inactividad, router]);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig((prev: any) => ({ ...prev, ...cfgMap }));
    }
  };

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
    setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true, permiso_reportes: false });
    fetchEmpleados();
  };

  const toggleEstado = async (emp: any) => {
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id);
  };

  const exportarExcel = () => {
    const dataExport = empleados.map(e => ({
      Nombre: e.nombre,
      Documento: e.documento_id,
      Email: e.email,
      Rol: e.rol,
      Estado: e.activo ? 'ACTIVO' : 'INACTIVO',
      Acceso_Reportes: e.permiso_reportes ? 'SI' : 'NO'
    }));
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    XLSX.writeFile(wb, `Personal_${config.empresa_nombre}.xlsx`);
  };

  const empleadosFiltrados = empleados.filter(e => 
    e.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    e.documento_id.includes(filtro)
  );

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        <header className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
              GESTIÓN DE <span className="text-blue-500">PERSONAL</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2 italic">
              {config.empresa_nombre}
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-emerald-900/20">
              📊 Exportar Excel
            </button>
            {/* Botón Volver al Menú Anterior (Admin) */}
            <button onClick={() => router.push('/admin')} className="bg-[#1e293b] hover:bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all border border-white/5 shadow-xl">
              ← Volver
            </button>
          </div>
        </header>

        {/* FORMULARIO DE REGISTRO / EDICIÓN */}
        <div className="bg-[#0f172a] p-8 rounded-[35px] border border-white/5 mb-12 shadow-2xl">
          <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
            <div className="lg:col-span-1">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block italic">Nombre Completo</label>
              <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs uppercase outline-none focus:border-blue-500 transition-all" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value.toUpperCase()})} required />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block italic">Documento</label>
              <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500 transition-all" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block italic">Email</label>
              <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500 transition-all" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value.toLowerCase()})} required />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block italic">PIN</label>
              <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500 transition-all" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block italic">Rol Asignado</label>
              <select className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500 transition-all cursor-pointer" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
                <option value="empleado">EMPLEADO</option>
                <option value="supervisor">SUPERVISOR</option>
                <option value="admin">ADMINISTRADOR</option>
                <option value="tecnico">TÉCNICO</option>
              </select>
            </div>
            <div className="flex flex-col items-center">
              <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block italic text-center">Permiso Reportes</label>
              <button type="button" onClick={() => setNuevo({...nuevo, permiso_reportes: !nuevo.permiso_reportes})} className={`w-full p-4 rounded-xl border font-black text-[9px] uppercase transition-all ${nuevo.permiso_reportes ? 'bg-blue-600/20 border-blue-500 text-blue-500' : 'bg-[#050a14] border-white/10 text-slate-500'}`}>
                {nuevo.permiso_reportes ? 'Autorizado' : 'Bloqueado'}
              </button>
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 p-4 rounded-xl font-black text-xs uppercase transition-all shadow-lg shadow-blue-600/20 active:scale-95">
              {editando ? 'Actualizar' : 'Registrar'}
            </button>
          </form>
        </div>

        {/* LISTADO DE EMPLEADOS */}
        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 bg-white/[0.02]">
            <input type="text" placeholder="BUSCAR POR NOMBRE O DOCUMENTO..." className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-700" value={filtro} onChange={e => setFiltro(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 bg-black/10">
                  <th className="py-6 px-8">Identificación</th>
                  <th className="py-6 px-4">Contacto / PIN</th>
                  <th className="py-6 px-4 text-center">Rol</th>
                  <th className="py-6 px-4 text-center">Permisos</th>
                  <th className="py-6 px-4 text-center">Estado</th>
                  <th className="py-6 px-8 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="py-5 px-8">
                      <p className="font-bold text-sm uppercase text-white">{emp.nombre}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-1 tracking-tighter">{emp.documento_id}</p>
                    </td>
                    <td className="py-5 px-4">
                      <p className="text-xs text-slate-400">{emp.email}</p>
                      <p className="text-[9px] font-black text-blue-500 mt-1 uppercase tracking-tighter">PIN: {emp.pin_seguridad}</p>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <span className="text-[9px] font-black uppercase bg-slate-800 px-3 py-1 rounded-md text-slate-400">
                        {emp.rol === 'admin' ? 'administrador' : emp.rol}
                      </span>
                    </td>
                    <td className="py-5 px-4 text-center">
                      {emp.permiso_reportes ? (
                        <span className="text-[8px] font-black bg-blue-500/10 text-blue-500 px-2 py-1 rounded uppercase">📊 Reportes</span>
                      ) : (
                        <span className="text-[8px] font-black bg-white/5 text-slate-600 px-2 py-1 rounded uppercase">Ninguno</span>
                      )}
                    </td>
                    <td className="py-5 px-4 text-center">
                      <button onClick={() => toggleEstado(emp)} className={`px-4 py-1.5 rounded-lg font-black text-[9px] uppercase transition-all ${emp.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 hover:bg-emerald-500/20' : 'bg-red-600 text-white hover:bg-red-500'}`}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="py-5 px-8 text-center">
                      <button onClick={() => { setEditando(emp); setNuevo(emp); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="text-blue-500 hover:text-white font-black text-[10px] uppercase transition-colors tracking-widest">
                        EDITAR
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