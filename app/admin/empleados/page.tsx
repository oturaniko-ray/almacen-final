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
  
  const estadoInicial = { 
    nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true, permiso_reportes: false, nivel_acceso: 1 
  };
  const [nuevo, setNuevo] = useState(estadoInicial);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    fetchEmpleados();
  }, []);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  // LÓGICA DE NIVELES SEGÚN ROL
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
    const payload = { ...nuevo };
    if (editando) {
      await supabase.from('empleados').update(payload).eq('id', editando.id);
    } else {
      await supabase.from('empleados').insert([payload]);
    }
    setEditando(null);
    setNuevo(estadoInicial);
    fetchEmpleados();
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(empleados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    XLSX.writeFile(wb, "Gestion_Personal.xlsx");
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-4 text-white font-sans">
      <div className="max-w-[100%] mx-auto">
        
        {/* 1 y 2. MEMBRETE UNIFICADO */}
        <div className="flex justify-between items-end mb-6 border-b border-white/5 pb-4">
          <div>
            <h1 className="text-2xl font-black italic uppercase text-white">
              GESTIÓN DE <span className="text-blue-500">PERSONAL</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {user?.nombre} <span className="text-blue-500">[{user?.rol}]</span> ({user?.nivel_acceso})
            </p>
          </div>
          <div className="flex gap-2">
            {/* 3. BOTÓN EXPORTAR */}
            <button onClick={exportarExcel} className="bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-emerald-600/40">
              📊 EXPORTAR
            </button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/10">
              VOLVER
            </button>
          </div>
        </div>

        {/* 4. EDITOR EN UNA SOLA LÍNEA */}
        <div className={`p-6 rounded-[30px] border mb-8 transition-all ${editando ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5 bg-[#0f172a]'}`}>
          <form onSubmit={handleGuardar} className="flex flex-wrap lg:flex-nowrap gap-3 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">Nombre completo</label>
              <input className="w-full bg-black/40 p-3 rounded-xl border border-white/10 text-[11px] outline-none focus:border-blue-500" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} required />
            </div>
            <div className="w-[120px]">
              <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">DNI/NIE/PASS</label>
              <input className="w-full bg-black/40 p-3 rounded-xl border border-white/10 text-[11px] outline-none focus:border-blue-500 text-center" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">Email</label>
              <input className="w-full bg-black/40 p-3 rounded-xl border border-white/10 text-[11px] outline-none focus:border-blue-500" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value.toLowerCase()})} required />
            </div>
            <div className="w-[80px]">
              <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">Pin</label>
              <input className="w-full bg-black/40 p-3 rounded-xl border border-white/10 text-[11px] outline-none focus:border-blue-500 text-center font-mono" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            </div>
            <div className="w-[130px]">
              <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2">Rol</label>
              <select className="w-full bg-black/40 p-3 rounded-xl border border-white/10 text-[10px] font-black outline-none focus:border-blue-500" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value, nivel_acceso: e.target.value === 'supervisor' ? 3 : e.target.value === 'admin' ? 4 : e.target.value === 'tecnico' ? 8 : 1})}>
                <option value="empleado">EMPLEADO</option>
                <option value="supervisor">SUPERVISOR</option>
                <option value="admin">ADMINISTRADOR</option>
                <option value="tecnico">TÉCNICO</option>
              </select>
            </div>
            <div className="w-[80px]">
              <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2 text-center">Reporte</label>
              <select className="w-full bg-black/40 p-3 rounded-xl border border-white/10 text-[10px] font-black text-center" value={nuevo.permiso_reportes ? 'si' : 'no'} onChange={e => setNuevo({...nuevo, permiso_reportes: e.target.value === 'si'})}>
                <option value="no">NO</option>
                <option value="si">SÍ</option>
              </select>
            </div>
            <div className="w-[80px]">
              <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-2 text-center">Acceso</label>
              <select className="w-full bg-black/40 p-3 rounded-xl border border-white/10 text-[10px] font-black text-center" value={nuevo.nivel_acceso} onChange={e => setNuevo({...nuevo, nivel_acceso: parseInt(e.target.value)})}>
                {obtenerOpcionesNivel().map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button type="submit" className={`p-3 w-[60px] rounded-xl font-black text-xs uppercase transition-all shadow-lg ${editando ? 'bg-amber-500' : 'bg-blue-600'}`}>
              OK
            </button>
          </form>
        </div>

        {/* LISTADO DE PERSONAL */}
        <div className="bg-[#0f172a] rounded-[30px] border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <input type="text" placeholder="BUSCAR POR NOMBRE O DNI..." className="w-full bg-black/20 border border-white/10 rounded-xl px-6 py-3 text-[10px] font-black uppercase outline-none focus:border-blue-500" value={filtro} onChange={e => setFiltro(e.target.value)} />
          </div>
          <table className="w-full text-left">
            <thead className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-black/20">
              <tr>
                <th className="p-5">Colaborador</th>
                <th className="p-5">DNI / Email</th>
                <th className="p-5 text-center">Rol / Nivel</th>
                <th className="p-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {empleados.filter(e => e.nombre.toLowerCase().includes(filtro.toLowerCase())).map((emp) => (
                <tr key={emp.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-5">
                    <p className="font-bold text-[12px] uppercase text-white leading-none">{emp.nombre}</p>
                    <p className="text-[9px] text-emerald-500 font-black mt-1 uppercase">● {emp.activo ? 'Activo' : 'Inactivo'}</p>
                  </td>
                  <td className="p-5 font-mono text-[11px]">
                    <span className="text-white block">{emp.documento_id}</span>
                    <span className="text-slate-500 text-[9px]">{emp.email}</span>
                  </td>
                  <td className="p-5 text-center">
                    <span className="text-[9px] font-black uppercase bg-slate-800 px-3 py-1 rounded text-blue-400 border border-blue-500/20">
                      {emp.rol} (Lvl {emp.nivel_acceso})
                    </span>
                  </td>
                  <td className="p-5 text-center flex gap-2 justify-center">
                    <button onClick={() => { setEditando(emp); setNuevo(emp); }} className="text-blue-500 hover:text-white font-black text-[10px] uppercase transition-all px-4 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-600">Editar</button>
                    <button onClick={async () => { await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id); fetchEmpleados(); }} className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase ${emp.activo ? 'text-rose-500 border border-rose-500/20' : 'text-emerald-500 border border-emerald-500/20'}`}>{emp.activo ? 'Baja' : 'Alta'}</button>
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