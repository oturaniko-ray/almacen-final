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
  
  const estadoInicial = { 
    nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true, permiso_reportes: false 
  };
  const [nuevo, setNuevo] = useState(estadoInicial);

  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  // 1. CARGA DE SESIÓN Y DATOS INICIALES
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

    // ESCUCHA DE SESIÓN GLOBAL
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

    // SUSCRIPCIÓN REALTIME PARA CAMBIOS EN TIEMPO REAL
    const canalEmpleados = supabase
      .channel('realtime-empleados')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'empleados' },
        () => {
          fetchEmpleados(); 
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(canalSession);
      supabase.removeChannel(canalEmpleados);
    };
  }, [router]);

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
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timeout);
      eventos.forEach(e => window.removeEventListener(e, resetTimer));
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
    try {
      const { data: existente } = await supabase
        .from('empleados')
        .select('id, nombre')
        .eq('pin_seguridad', nuevo.pin_seguridad)
        .maybeSingle();

      if (existente && (!editando || existente.id !== editando.id)) {
        alert(`¡ERROR SEGURIDAD! El PIN ya lo tiene: ${existente.nombre}.`);
        return; 
      }

      const payload = { ...nuevo, rol: nuevo.rol.toLowerCase() };
      if (editando) {
        const { error } = await supabase.from('empleados').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('empleados').insert([payload]);
        if (error) throw error;
      }
      setEditando(null);
      setNuevo(estadoInicial);
      fetchEmpleados();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setEditando(null);
      setNuevo(estadoInicial);
    }
  };

  const exportarExcel = () => {
    const dataExport = empleados.map(e => ({ 
      Nombre: e.nombre, 
      Documento: e.documento_id, 
      Email: e.email, 
      Rol: e.rol,
      Estado: e.en_almacen ? 'DENTRO' : 'FUERA'
    }));
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    XLSX.writeFile(wb, `Personal_${config.empresa_nombre}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans relative">
      <div className="max-w-7xl mx-auto">
        
        <div className="sticky top-0 z-50 pt-2 pb-8 bg-[#050a14]">
          <div className={`p-8 rounded-[40px] border-2 transition-all duration-500 shadow-2xl ${editando ? 'bg-blue-950/40 border-blue-500' : 'bg-[#0f172a] border-white/5'}`}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
                  GESTIÓN DE <span className="text-blue-500">PERSONAL</span>
                </h1>
                {user && (
                  <div className="mt-2 flex flex-col">
                    <span className="text-xs font-black uppercase text-blue-400 tracking-widest leading-none">{user.nombre}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase italic tracking-tighter">Acceso: {user.rol}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {(editando || nuevo.nombre !== '' || nuevo.pin_seguridad !== '') && (
                  <button onClick={() => {setEditando(null); setNuevo(estadoInicial);}} className="bg-red-600/20 text-red-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase border border-red-500/30 hover:bg-red-600 hover:text-white transition-all">Cancelar ✕</button>
                )}
                <button onClick={exportarExcel} className="bg-emerald-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-900/20 hover:scale-105 transition-all">📊 Excel</button>
                <button onClick={() => router.push('/admin')} className="bg-slate-800 px-6 py-3 rounded-2xl text-[10px] font-black uppercase border border-white/5 hover:bg-slate-700 transition-all">← Volver</button>
              </div>
            </div>
            
            <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Nombre</label>
                <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} required />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">ID Documento</label>
                <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Email</label>
                <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value.toLowerCase()})} required />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Pin Único</label>
                <input className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-xs outline-none focus:border-blue-500" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Rol</label>
                <select className="w-full bg-[#050a14] p-4 rounded-xl border border-white/10 text-[10px] font-black outline-none focus:border-blue-500" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
                  <option value="empleado">EMPLEADO</option>
                  <option value="supervisor">SUPERVISOR</option>
                  <option value="tecnico">TÉCNICO</option>
                  <option value="admin">ADMINISTRADOR</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block text-center italic">Reportes</label>
                <button type="button" onClick={() => setNuevo({...nuevo, permiso_reportes: !nuevo.permiso_reportes})} className={`w-full p-4 rounded-xl border font-black text-[10px] uppercase transition-all ${nuevo.permiso_reportes ? 'bg-blue-600 border-blue-400 text-white' : 'bg-[#050a14] border-white/10 text-slate-500'}`}>{nuevo.permiso_reportes ? 'SÍ' : 'NO'}</button>
              </div>
              <button type="submit" className={`${editando ? 'bg-amber-500 shadow-amber-900/40' : 'bg-blue-600 shadow-blue-900/40'} p-4 rounded-xl font-black text-xs uppercase shadow-xl transition-all`}>{editando ? 'Actualizar' : 'Registrar'}</button>
            </form>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[45px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-6 bg-white/[0.02] border-b border-white/5">
            <input type="text" placeholder="BUSCAR POR NOMBRE O ID..." className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-8 py-4 text-[11px] font-black uppercase outline-none focus:border-blue-500 transition-all" value={filtro} onChange={e => setFiltro(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] border-b border-white/5 bg-black/20">
                  <th className="py-8 px-10">Colaborador</th>
                  <th className="py-8 px-6">Contacto / PIN</th>
                  <th className="py-8 px-6 text-center">Rol</th>
                  <th className="py-8 px-10 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleados.filter(e => e.nombre.toLowerCase().includes(filtro.toLowerCase())).map((emp) => (
                  <tr key={emp.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="py-6 px-10">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                          {emp.en_almacen && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                          <span className={`relative inline-flex rounded-full h-3 w-3 ${emp.en_almacen ? 'bg-emerald-500' : 'bg-white/10'}`}></span>
                        </div>
                        <div>
                          <p className="font-black text-sm uppercase text-white leading-none">{emp.nombre}</p>
                          <p className="text-[10px] text-slate-500 font-mono tracking-widest mt-1">{emp.documento_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-6">
                      <p className="text-[11px] text-slate-400 mb-1">{emp.email}</p>
                      <div className="relative h-5 overflow-hidden w-32 cursor-help group/pin">
                        <div className="flex flex-col transition-transform duration-300 ease-in-out transform group-hover/pin:-translate-y-5">
                          <div className="h-5 flex items-center"><span className="text-blue-500/30 font-black tracking-[0.3em] text-[10px]">••••••••</span></div>
                          <div className="h-5 flex items-center"><span className="text-yellow-400 font-black italic text-[11px] tracking-tighter">PIN: {emp.pin_seguridad}</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-6 text-center">
                      <span className="text-[10px] font-black uppercase bg-slate-800 px-4 py-1.5 rounded-lg text-slate-400 border border-white/5">{emp.rol}</span>
                    </td>
                    <td className="py-6 px-10 text-center flex gap-3 justify-center">
                      <button onClick={() => { setEditando(emp); setNuevo(emp); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="text-blue-500 hover:text-white font-black text-[11px] uppercase transition-all px-4 py-2 rounded-xl border border-blue-500/20 hover:bg-blue-600">EDITAR</button>
                      <button onClick={async () => await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id).then(() => fetchEmpleados())} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${emp.activo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-600 text-white'}`}>{emp.activo ? 'Activo' : 'Inactivo'}</button>
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