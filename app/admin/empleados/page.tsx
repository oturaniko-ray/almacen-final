'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionEmpleados() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [filtro, setFiltro] = useState(''); 
  const [sesionExpulsada, setSesionExpulsada] = useState(false);
  const [config, setConfig] = useState<any>({ empresa_nombre: 'SISTEMA RAY', timer_inactividad: '120000' });
  
  // Estado inicial del formulario
  const estadoInicial = { 
    nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true, permiso_reportes: false 
  };
  const [nuevo, setNuevo] = useState(estadoInicial);

  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador', 'tecnico'].includes(currentUser.rol.toLowerCase())) {
      router.replace('/'); return;
    }
    setUser(currentUser);
    fetchConfig();
    fetchEmpleados();

    // Control de sesión duplicada
    const canalSession = supabase.channel('global-session-control');
    canalSession.on('broadcast', { event: 'nueva-sesion' }, (payload) => {
      if (payload.payload.userEmail === currentUser.email && payload.payload.sid !== sessionId.current) {
        setSesionExpulsada(true);
        setTimeout(() => { localStorage.removeItem('user_session'); window.location.reload(); }, 3000);
      }
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await canalSession.send({ type: 'broadcast', event: 'nueva-sesion', payload: { sid: sessionId.current, userEmail: currentUser.email } });
      }
    });

    return () => { supabase.removeChannel(canalSession); };
  }, [router]);

  // Inactividad dinámica
  useEffect(() => {
    if (!user) return;
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => { localStorage.removeItem('user_session'); router.replace('/'); }, parseInt(config.timer_inactividad));
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();
    return () => { clearTimeout(timeout); window.removeEventListener('mousemove', resetTimer); window.removeEventListener('keydown', resetTimer); };
  }, [user, config.timer_inactividad]);

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
    cancelarEdicion();
    fetchEmpleados();
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setNuevo(estadoInicial);
  };

  const exportarExcel = () => {
    const dataExport = empleados.map(e => ({ Nombre: e.nombre, Documento: e.documento_id, Email: e.email, Rol: e.rol }));
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    XLSX.writeFile(wb, `Personal_${config.empresa_nombre}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans relative">
      {sesionExpulsada && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center">
          <div className="text-red-500 font-black uppercase italic animate-pulse">Sesión Duplicada - Redirigiendo...</div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">GESTIÓN DE <span className="text-blue-500">PERSONAL</span></h1>
            {user && (
              <div className="mt-2">
                <p className="text-xs font-black uppercase text-white">{user.nombre}</p>
                <p className="text-[9px] font-bold text-blue-400 uppercase italic tracking-[0.3em]">{user.rol === 'admin' ? 'administrador' : user.rol}</p>
              </div>
            )}
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600 mt-4 italic border-t border-white/5 pt-2">{config.empresa_nombre}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="bg-emerald-600 px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg shadow-emerald-900/20">📊 Excel</button>
            <button onClick={() => router.push('/admin')} className="bg-[#1e293b] px-6 py-3 rounded-2xl font-black text-xs uppercase border border-white/5">← Volver</button>
          </div>
        </header>

        {/* Formulario de Registro / Edición (FIJO) */}
        <div className={`p-8 rounded-[35px] border transition-all duration-500 mb-12 shadow-2xl ${editando ? 'bg-blue-900/10 border-blue-500/30' : 'bg-[#0f172a] border-white/5'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xs font-black uppercase italic tracking-widest text-slate-400">
              {editando ? '⚠️ Editando Datos de Empleado' : '📝 Registrar Nuevo Empleado'}
            </h2>
            {editando && <button onClick={cancelarEdicion} className="text-[10px] font-black uppercase text-red-500 hover:text-white">Cancelar Edición ✕</button>}
          </div>
          
          <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
            <div className="lg:col-span-1">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Nombre</label>
              <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs uppercase outline-none focus:border-blue-500" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value.toUpperCase()})} required />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Documento</label>
              <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Email</label>
              <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value.toLowerCase()})} required />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">PIN</label>
              <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Rol</label>
              <select className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
                <option value="empleado">EMPLEADO</option>
                <option value="supervisor">SUPERVISOR</option>
                <option value="admin">ADMINISTRADOR</option>
                <option value="tecnico">TÉCNICO</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block text-center">Reportes</label>
              <button type="button" onClick={() => setNuevo({...nuevo, permiso_reportes: !nuevo.permiso_reportes})} className={`w-full p-4 rounded-xl border font-black text-[9px] uppercase transition-all ${nuevo.permiso_reportes ? 'bg-blue-600/20 border-blue-500 text-blue-500' : 'bg-[#050a14] border-white/10 text-slate-500'}`}>{nuevo.permiso_reportes ? 'SI' : 'NO'}</button>
            </div>
            <button type="submit" className={`${editando ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'} p-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all`}>
              {editando ? 'Actualizar' : 'Registrar'}
            </button>
          </form>
        </div>

        {/* Listado */}
        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-6 bg-white/[0.02] border-b border-white/5">
            <input type="text" placeholder="BUSCAR PERSONAL..." className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-6 py-3 text-[10px] font-black uppercase outline-none focus:border-blue-500 transition-all" value={filtro} onChange={e => setFiltro(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                  <th className="py-6 px-8">Empleado</th>
                  <th className="py-6 px-4">Contacto / PIN</th>
                  <th className="py-6 px-4 text-center">Rol</th>
                  <th className="py-6 px-4 text-center">Estado</th>
                  <th className="py-6 px-8 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleados.filter(e => e.nombre.toLowerCase().includes(filtro.toLowerCase()) || e.documento_id.includes(filtro)).map((emp) => (
                  <tr key={emp.id} className="group hover:bg-white/[0.01]">
                    <td className="py-5 px-8">
                      <p className="font-bold text-sm uppercase">{emp.nombre}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-1">{emp.documento_id}</p>
                    </td>
                    <td className="py-5 px-4">
                      <p className="text-xs text-slate-400">{emp.email}</p>
                      <div className="relative group/pin h-4 mt-1 overflow-hidden">
                         <p className="text-[10px] font-black text-blue-500 uppercase transition-all duration-300 group-hover/pin:-translate-y-full">****</p>
                         <p className="text-[10px] font-black text-yellow-400 uppercase transition-all duration-300 translate-y-full group-hover/pin:translate-y-0 absolute top-0 italic">PIN: {emp.pin_seguridad}</p>
                      </div>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <span className="text-[9px] font-black uppercase bg-slate-800 px-3 py-1 rounded-md text-slate-400">{emp.rol === 'admin' ? 'administrador' : emp.rol}</span>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <button onClick={async () => await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id).then(() => fetchEmpleados())} className={`px-4 py-1.5 rounded-lg font-black text-[9px] uppercase transition-all ${emp.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' : 'bg-red-600 text-white'}`}>{emp.activo ? 'Activo' : 'Inactivo'}</button>
                    </td>
                    <td className="py-5 px-8 text-center">
                      <button onClick={() => { setEditando(emp); setNuevo(emp); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="text-blue-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors">EDITAR</button>
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