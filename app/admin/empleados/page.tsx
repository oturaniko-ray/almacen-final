'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionEmpleados() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [filtro, setFiltro] = useState('');
  
  const estadoInicial = { 
    nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true, permiso_reportes: false, nivel_acceso: 1 
  };
  const [nuevo, setNuevo] = useState(estadoInicial);
  const router = useRouter();

  // Función de carga envuelta en useCallback para estabilidad
  const fetchEmpleados = useCallback(async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    
    // Carga inicial
    fetchEmpleados();

    // AJUSTE TIEMPO REAL: Suscripción al canal de cambios en la tabla empleados
    const channel = supabase
      .channel('realtime_personal_management')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'empleados' }, 
        () => {
          fetchEmpleados(); // Recarga los datos ante cualquier cambio detectado
        }
      )
      .subscribe();

    // Limpieza de suscripción al desmontar el componente
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEmpleados]);

  const obtenerOpcionesNivel = () => {
    const r = nuevo.rol;
    if (r === 'empleado') return [1, 2];
    if (r === 'supervisor') return [3];
    if (r === 'admin') return [4, 5, 6, 7];
    if (r === 'tecnico') return [8, 9, 10];
    return [1];
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: existe } = await supabase
      .from('empleados')
      .select('id, nombre')
      .eq('pin_seguridad', nuevo.pin_seguridad)
      .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000')
      .single();

    if (existe) {
      alert(`⚠️ ERROR: El PIN ya está asignado a ${existe.nombre}. Elija uno nuevo.`);
      document.getElementById('pin_input')?.focus();
      return;
    }

    const payload = { ...nuevo };
    if (editando) {
      await supabase.from('empleados').update(payload).eq('id', editando.id);
    } else {
      await supabase.from('empleados').insert([payload]);
    }
    cancelarEdicion();
    // No es estrictamente necesario llamar a fetchEmpleados aquí 
    // porque la suscripción lo hará automáticamente por nosotros
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setNuevo(estadoInicial);
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(empleados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    XLSX.writeFile(wb, "Gestion_Personal.xlsx");
  };

  return (
    <main className="min-h-screen bg-[#050a14] text-white font-sans flex flex-col">
      <div className="sticky top-0 z-50 bg-[#050a14]/95 backdrop-blur-md p-4 border-b border-white/10 shadow-2xl">
        <div className="max-w-[100%] mx-auto">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-2xl font-black italic uppercase text-white">
                GESTIÓN DE <span className="text-blue-500">PERSONAL</span>
              </h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {user?.nombre} <span className="text-blue-500">{user?.rol}</span> ({user?.nivel_acceso})
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportarExcel} className="bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-emerald-600/40">
                📊 EXPORTAR
              </button>
              <button onClick={() => router.push('/admin')} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/10">
                VOLVER
              </button>
            </div>
          </div>

          <div className={`p-4 rounded-[20px] border transition-all ${editando ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5 bg-[#0f172a]'}`}>
            <form onSubmit={handleGuardar} className="flex flex-wrap lg:flex-nowrap gap-3 items-end">
              <div className="flex-1 min-w-[150px]">
                <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">Nombre completo</label>
                <input className="w-full bg-black/40 p-2.5 rounded-xl border border-white/10 text-[11px] outline-none focus:border-blue-500" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} required />
              </div>
              <div className="w-[110px]">
                <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">DNI/NIE/PASS</label>
                <input className="w-full bg-black/40 p-2.5 rounded-xl border border-white/10 text-[11px] outline-none focus:border-blue-500 text-center uppercase" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">Email</label>
                <input className="w-full bg-black/40 p-2.5 rounded-xl border border-white/10 text-[11px] outline-none focus:border-blue-500" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value.toLowerCase()})} required />
              </div>
              <div className="w-[75px]">
                <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">Pin</label>
                <input id="pin_input" className="w-full bg-black/40 p-2.5 rounded-xl border border-white/10 text-[11px] outline-none focus:border-blue-500 text-center font-mono" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
              </div>
              <div className="w-[120px]">
                <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">Rol</label>
                <select className="w-full bg-black/40 p-2.5 rounded-xl border border-white/10 text-[10px] font-black outline-none focus:border-blue-500" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value, nivel_acceso: e.target.value === 'supervisor' ? 3 : e.target.value === 'admin' ? 4 : e.target.value === 'tecnico' ? 8 : 1})}>
                  <option value="empleado">EMPLEADO</option>
                  <option value="supervisor">SUPERVISOR</option>
                  <option value="admin">ADMINISTRADOR</option>
                  <option value="tecnico">TÉCNICO</option>
                </select>
              </div>
              <div className="w-[75px]">
                <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2 text-center">Reporte</label>
                <select className="w-full bg-black/40 p-2.5 rounded-xl border border-white/10 text-[10px] font-black text-center" value={nuevo.permiso_reportes ? 'si' : 'no'} onChange={e => setNuevo({...nuevo, permiso_reportes: e.target.value === 'si'})}>
                  <option value="no">NO</option>
                  <option value="si">SÍ</option>
                </select>
              </div>
              <div className="w-[75px]">
                <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2 text-center">Acceso</label>
                <select className="w-full bg-black/40 p-2.5 rounded-xl border border-white/10 text-[10px] font-black text-center" value={nuevo.nivel_acceso} onChange={e => setNuevo({...nuevo, nivel_acceso: parseInt(e.target.value)})}>
                  {obtenerOpcionesNivel().map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              
              <div className="flex flex-col gap-1">
                {editando && (
                  <button type="button" onClick={cancelarEdicion} className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg p-1 text-[9px] font-black transition-all">
                    ✕ CANCELAR
                  </button>
                )}
                <button type="submit" className={`p-2.5 w-[70px] rounded-xl font-black text-xs uppercase transition-all shadow-lg ${editando ? 'bg-amber-500' : 'bg-blue-600'}`}>
                  OK
                </button>
              </div>
            </form>
          </div>
          
          <div className="bg-black/20 p-2 border border-white/5 rounded-xl flex items-center">
             <input type="text" placeholder="BUSCAR..." className="w-full bg-transparent px-4 text-[11px] font-black uppercase outline-none" value={filtro} onChange={e => setFiltro(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-[100%] mx-auto bg-[#0f172a] rounded-[30px] border border-white/5">
          <table className="w-full text-left">
            <thead className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-black/20 sticky top-0 z-40 backdrop-blur-sm shadow-sm">
              <tr>
                <th className="p-5">Empleado</th>
                <th className="p-5">DNI / Email</th>
                <th className="p-5 text-center">Rol / Pin</th>
                <th className="p-5 text-center">Level / A.Rep</th>
                <th className="p-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {empleados.filter(e => e.nombre.toLowerCase().includes(filtro.toLowerCase())).map((emp) => (
                <tr key={emp.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-white/10'}`}></div>
                      <p className="font-black text-[14px] uppercase text-white leading-none tracking-tight">{emp.nombre}</p>
                    </div>
                  </td>
                  <td className="p-5 font-mono text-[11px]">
                    <span className="text-white block">{emp.documento_id}</span>
                    <span className="text-slate-500 text-[11px]">{emp.email}</span>
                  </td>
                  <td className="p-5 text-center">
                    <p className="text-[10px] font-black uppercase text-blue-400">{emp.rol}</p>
                    <div className="group relative mt-1">
                      <p className="text-[10px] font-mono text-slate-600 group-hover:hidden tracking-widest">••••</p>
                      <p className="text-[10px] font-mono text-amber-500 hidden group-hover:block font-bold">PIN: {emp.pin_seguridad}</p>
                    </div>
                  </td>
                  <td className="p-5 text-center font-black">
                    <span className="text-white text-[12px]">{emp.nivel_acceso}</span>
                    <span className="text-slate-600 mx-2">/</span>
                    <span className={emp.permiso_reportes ? 'text-emerald-500 text-[11px]' : 'text-rose-500 text-[11px]'}>
                      {emp.permiso_reportes ? 'SI' : 'NO'}
                    </span>
                  </td>
                  <td className="p-5 text-center flex gap-2 justify-center">
                    <button onClick={() => { setEditando(emp); setNuevo(emp); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="text-blue-500 hover:text-white font-black text-[11px] uppercase px-4 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all">Editar</button>
                    <button 
                      onClick={async () => { await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id); }} 
                      className={`px-4 py-1.5 rounded-lg font-black text-[11px] uppercase border transition-all ${emp.activo ? 'text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10' : 'text-rose-600 border-rose-600/20 hover:bg-rose-600/10'}`}
                    >
                      {emp.activo ? 'Activo' : 'Inactivo'}
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