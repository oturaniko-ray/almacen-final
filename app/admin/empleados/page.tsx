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
    setUser(JSON.parse(sessionData));
    
    fetchEmpleados();

    // 🟢 TIEMPO REAL SIN TOCAR LA ESTÉTICA
    const channel = supabase
      .channel('realtime-gestion')
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
      if (editando.en_almacen && editando.activo === true && nuevo.activo === false) {
        alert("⚠️ BLOQUEO DE SEGURIDAD: No se puede desactivar a un empleado que está en el almacén.");
        return;
      }
      await supabase.from('empleados').update(nuevo).eq('id', editando.id);
    } else {
      await supabase.from('empleados').insert([nuevo]);
    }
    setEditando(null);
    setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
    fetchEmpleados();
  };

  const toggleEstado = async (emp: any) => {
    if (emp.en_almacen && emp.activo === true) {
      alert(`⚠️ ACCIÓN DENEGADA: ${emp.nombre} está en el almacén.`);
      return;
    }
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id);
    fetchEmpleados();
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(empleados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empleados");
    XLSX.writeFile(wb, "Listado_Empleados_RAY.xlsx");
  };

  const empleadosFiltrados = empleados.filter(e => 
    e.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    e.documento_id.includes(filtro)
  );

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* CABECERA UNIFICADA */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
              GESTIÓN DE <span className="text-blue-500">PERSONAL</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">SESIÓN:</p>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] italic">{user?.nombre || '---'}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-lg">Exportar Excel</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all">Volver</button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* FORMULARIO */}
          <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 h-fit shadow-2xl">
            <h2 className="text-xl font-black italic uppercase mb-6 text-blue-500">
              {editando ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'}
            </h2>
            <form onSubmit={handleGuardar} className="space-y-4">
              <input type="text" placeholder="NOMBRE COMPLETO" className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all uppercase" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value.toUpperCase()})} required />
              <input type="text" placeholder="DOCUMENTO ID" className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
              <input type="email" placeholder="EMAIL" className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value})} required />
              <input type="text" placeholder="PIN SEGURIDAD" className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
              <select className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
                <option value="empleado">OPERATIVO / EMPLEADO</option>
                <option value="supervisor">SUPERVISOR</option>
                <option value="admin">ADMINISTRADOR</option>
              </select>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20">
                {editando ? 'Actualizar' : 'Registrar'}
              </button>
              {editando && <button type="button" onClick={() => { setEditando(null); setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true }); }} className="w-full bg-slate-800 py-3 rounded-2xl font-black text-[10px] uppercase mt-2">Cancelar Edición</button>}
            </form>
          </div>

          {/* LISTADO */}
          <div className="lg:col-span-2 bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
              <input type="text" placeholder="FILTRAR POR NOMBRE O DOCUMENTO..." className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-6 py-3 text-[10px] font-black tracking-widest" value={filtro} onChange={e => setFiltro(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                    <th className="py-5 px-8">Empleado / Rol</th>
                    <th className="py-5 px-4 text-center">Pin / ID</th>
                    <th className="py-5 px-4 text-center">Estado</th>
                    <th className="py-5 px-8 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {empleadosFiltrados.map((emp) => (
                    <tr key={emp.id} className="group hover:bg-white/[0.01] transition-colors">
                      <td className="py-5 px-8">
                        <div className="font-bold text-sm group-hover:text-blue-500 transition-colors flex items-center gap-2">
                          {emp.nombre}
                          {/* 🟢 RESTAURADO: Punto verde vibrante */}
                          {emp.en_almacen && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" title="En Almacén"></span>}
                        </div>
                        <div className="text-[9px] font-black text-slate-500 uppercase">{emp.rol}</div>
                      </td>
                      <td className="py-5 px-4 text-center">
                        {/* 🔒 RESTAURADO: Ocultar PIN (Solo visible en Hover) */}
                        <div className="relative h-6 group/pin overflow-hidden cursor-pointer w-24 mx-auto">
                          <p className="text-[10px] font-black text-blue-500 uppercase transition-all duration-300 group-hover/pin:-translate-y-full">PIN OCULTO</p>
                          <p className="text-[10px] font-black text-yellow-400 uppercase transition-all duration-300 translate-y-full group-hover/pin:translate-y-0 absolute top-0 w-full">PIN: {emp.pin_seguridad}</p>
                        </div>
                        <div className="text-[9px] text-slate-600 font-mono mt-1">{emp.documento_id}</div>
                      </td>
                      <td className="py-5 px-4 text-center">
                        <button 
                          onClick={() => toggleEstado(emp)} 
                          className={`px-5 py-1.5 rounded-lg font-black text-[9px] uppercase transition-all shadow-lg ${emp.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white' : 'bg-red-600 text-white shadow-red-900/40 hover:bg-red-500'}`}
                        >
                          {emp.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="py-5 px-8 text-right">
                        <button onClick={() => { setEditando(emp); setNuevo(emp); }} className="text-blue-500 hover:text-blue-400 font-black text-[10px] uppercase tracking-widest transition-all">Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}