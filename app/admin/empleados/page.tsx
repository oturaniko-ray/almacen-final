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
    
    // Carga inicial
    fetchEmpleados();

    // 🟢 SUSCRIPCIÓN TIEMPO REAL: Actualiza la lista ante cualquier cambio en la tabla
    const channel = supabase
      .channel('realtime-empleados-gestion')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'empleados' }, 
        () => {
          fetchEmpleados(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rutina de seguridad: No desactivar si está en almacén
    if (editando && editando.en_almacen && editando.activo === true && nuevo.activo === false) {
      alert("⚠️ BLOQUEO DE SEGURIDAD: El empleado está dentro del almacén.");
      return;
    }

    if (editando) {
      await supabase.from('empleados').update(nuevo).eq('id', editando.id);
    } else {
      await supabase.from('empleados').insert([nuevo]);
    }
    setEditando(null);
    setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
    // fetchEmpleados se llamará automáticamente por el canal de tiempo real
  };

  const toggleEstado = async (emp: any) => {
    if (emp.en_almacen && emp.activo === true) {
      alert(`⚠️ ACCIÓN DENEGADA: ${emp.nombre} tiene una jornada activa en curso.`);
      return;
    }
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id);
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
        
        {/* CABECERA ESTILO MENÚ PRINCIPAL */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-1 bg-blue-500 rounded-full hidden md:block"></div>
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter">
                GESTIÓN DE <span className="text-blue-500">PERSONAL</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">SESIÓN:</p>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] italic">{user?.nombre || '---'}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button onClick={exportarExcel} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 px-6 py-4 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg">📥 EXPORTAR</button>
            <button onClick={() => router.push('/admin')} className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 px-6 py-4 rounded-2xl font-black text-[10px] uppercase transition-all">VOLVER</button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* FORMULARIO */}
          <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 h-fit shadow-2xl">
            <h2 className="text-xl font-black italic uppercase mb-6 text-white">
              {editando ? 'EDITAR' : 'NUEVO'} <span className="text-blue-500">REGISTRO</span>
            </h2>
            <form onSubmit={handleGuardar} className="space-y-4">
              <input type="text" placeholder="NOMBRE COMPLETO" className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value.toUpperCase()})} required />
              <input type="text" placeholder="DOCUMENTO ID" className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.documento_id} onChange={e => setNuevo({...nuevo, documento_id: e.target.value})} required />
              <input type="email" placeholder="EMAIL" className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.email} onChange={e => setNuevo({...nuevo, email: e.target.value})} required />
              <input type="text" placeholder="PIN SEGURIDAD" className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.pin_seguridad} onChange={e => setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
              <select className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" value={nuevo.rol} onChange={e => setNuevo({...nuevo, rol: e.target.value})}>
                <option value="empleado">OPERATIVO / EMPLEADO</option>
                <option value="supervisor">SUPERVISOR</option>
                <option value="admin">ADMINISTRADOR</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20">{editando ? 'Actualizar' : 'Registrar'}</button>
                {editando && <button type="button" onClick={() => { setEditando(null); setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true }); }} className="bg-slate-800 px-6 rounded-2xl font-black text-xs uppercase">X</button>}
              </div>
            </form>
          </div>

          {/* LISTADO TIEMPO REAL */}
          <div className="lg:col-span-2 bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center gap-4">
              <input type="text" placeholder="FILTRAR PERSONAL..." className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-6 py-3 text-[10px] font-black tracking-widest uppercase" value={filtro} onChange={e => setFiltro(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 bg-white/[0.01]">
                    <th className="py-6 px-8">Empleado</th>
                    <th className="py-6 px-4 text-center">Pin</th>
                    <th className="py-6 px-4 text-center">Estado</th>
                    <th className="py-6 px-8 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {empleadosFiltrados.map((emp) => (
                    <tr key={emp.id} className="group hover:bg-white/[0.01] transition-colors">
                      <td className="py-6 px-8">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={`w-2 h-2 rounded-full ${emp.en_almacen ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-slate-700'}`}></div>
                          </div>
                          <div>
                            <div className="font-bold text-sm uppercase flex items-center gap-2">
                              {emp.nombre}
                              {emp.en_almacen && <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 tracking-tighter">EN ALMACÉN</span>}
                            </div>
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-tighter italic">{emp.rol} • ID: {emp.documento_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-6 px-4 text-center">
                        <div className="relative h-6 group/pin overflow-hidden cursor-pointer w-24 mx-auto">
                          <p className="text-[10px] font-black text-blue-500/40 uppercase transition-all duration-300 group-hover/pin:-translate-y-full italic">Oculto</p>
                          <p className="text-[10px] font-black text-yellow-400 uppercase transition-all duration-300 translate-y-full group-hover/pin:translate-y-0 absolute top-0 w-full font-mono">{emp.pin_seguridad}</p>
                        </div>
                      </td>
                      <td className="py-6 px-4 text-center">
                        <button 
                          onClick={() => toggleEstado(emp)} 
                          className={`px-5 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${emp.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-600 text-white shadow-lg shadow-red-900/20'}`}
                        >
                          {emp.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="py-6 px-8 text-center">
                        <button onClick={() => { setEditando(emp); setNuevo(emp); }} className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-blue-500 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all">Editar</button>
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