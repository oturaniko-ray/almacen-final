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

  const fetchEmpleados = useCallback(async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    fetchEmpleados();
  }, [fetchEmpleados]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // LÓGICA QUIRÚRGICA: Normalización de datos en el guardado
    const empleadoData = {
      ...nuevo,
      nombre: nuevo.nombre.trim().toUpperCase(),
      documento_id: nuevo.documento_id.trim().toUpperCase()
    };

    if (editando) {
      const { error } = await supabase.from('empleados').update(empleadoData).eq('id', editando.id);
      if (!error) { setEditando(null); setNuevo(estadoInicial); fetchEmpleados(); }
    } else {
      const { error } = await supabase.from('empleados').insert([empleadoData]);
      if (!error) { setNuevo(estadoInicial); fetchEmpleados(); }
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(empleados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empleados");
    XLSX.writeFile(wb, "Nomina_Empleados.xlsx");
  };

  const filtrados = empleados.filter(e => 
    e.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    e.documento_id.includes(filtro)
  );

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-10 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-black italic text-white uppercase tracking-tighter">Gestión de <span className="text-blue-500">Personal</span></h1>
          </div>
          <div className="flex gap-4">
            <button onClick={exportToExcel} className="px-6 py-3 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-2xl border border-emerald-600/20 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20">Descargar DB</button>
            <button onClick={() => router.back()} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all">Regresar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 shadow-2xl sticky top-10">
              <h2 className="text-xl font-black text-white uppercase italic mb-6 tracking-tight">{editando ? 'Editar Empleado' : 'Nuevo Ingreso'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" placeholder="NOMBRE COMPLETO" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-500 transition-all uppercase" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})} required />
                <input type="text" placeholder="DOCUMENTO ID / DNI" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-500 transition-all" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
                <input type="email" placeholder="CORREO ELECTRÓNICO" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-500 transition-all" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value})} required />
                <input type="password" placeholder="PIN SEGURIDAD (4-6 DÍGITOS)" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold text-xs outline-none focus:border-blue-500 transition-all text-center" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
                
                <div className="grid grid-cols-2 gap-4">
                  <select className="bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-500 transition-all uppercase" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
                    <option value="empleado">Empleado</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <select className="bg-black/40 border border-white/10 p-4 rounded-xl text-white font-bold text-[10px] outline-none focus:border-blue-500 transition-all uppercase" value={nuevo.nivel_acceso} onChange={e => setNuevo({...nuevo, nivel_acceso: Number(e.target.value)})}>
                    {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>Nivel {n}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                  <input type="checkbox" id="permiso" checked={nuevo.permiso_reportes} onChange={e => setNuevo({...nuevo, permiso_reportes: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                  <label htmlFor="permiso" className="text-[10px] font-black uppercase text-slate-400 cursor-pointer">Permiso para Reportes</label>
                </div>

                <div className="flex gap-2 pt-4">
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20">{editando ? 'Actualizar' : 'Registrar'}</button>
                  {editando && <button type="button" onClick={() => {setEditando(null); setNuevo(estadoInicial);}} className="bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white px-6 rounded-xl font-black text-[10px] uppercase transition-all border border-rose-600/20">X</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-[#0f172a] rounded-[32px] border border-white/5 shadow-2xl overflow-hidden">
              <div className="p-6 bg-white/5 border-b border-white/5">
                <input type=\"text\" placeholder=\"Filtrar por nombre o documento...\" className=\"w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white font-bold text-xs outline-none focus:border-blue-500 transition-all\" value={filtro} onChange={e => setFiltro(e.target.value)} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/20 text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] italic">
                      <th className="p-5">Empleado</th>
                      <th className="p-5 text-center">Rol</th>
                      <th className="p-5 text-center">Nivel/Reportes</th>
                      <th className="p-5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtrados.map((emp) => (
                      <tr key={emp.id} className="hover:bg-blue-600/5 transition-all group">
                        <td className="p-5">
                          <p className="text-white font-black text-xs uppercase group-hover:text-blue-400 transition-colors">{emp.nombre}</p>
                          <p className="text-[9px] text-slate-500 font-mono mt-1">{emp.documento_id}</p>
                        </td>
                        <td className="p-5 text-center">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${emp.rol === 'admin' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' : emp.rol === 'supervisor' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'}`}>
                            {emp.rol}
                          </span>
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
                            onClick={async () => { await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id); fetchEmpleados(); }} 
                            className={`px-4 py-1.5 rounded-lg font-black text-[11px] uppercase border transition-all ${emp.activo ? 'text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10' : 'text-rose-600 border-rose-600/20 hover:bg-rose-600 hover:text-white'}`}
                          >
                            {emp.activo ? 'Activo' : 'Baja'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}