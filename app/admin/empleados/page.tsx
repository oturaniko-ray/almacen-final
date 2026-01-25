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
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    setUser(JSON.parse(sessionData));
    fetchEmpleados();
  }, []);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = editando || nuevo;
    const { error } = await supabase.from('empleados').upsert([payload]);
    if (error) alert("Error: " + error.message);
    else {
      setEditando(null);
      setNuevo({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
      fetchEmpleados();
    }
  };

  const toggleEstado = async (emp: any) => {
    const { error } = await supabase
      .from('empleados')
      .update({ activo: !emp.activo })
      .eq('id', emp.id);
    if (!error) fetchEmpleados();
  };

  const exportarExcel = () => {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().split('T')[0];
    const horaStr = ahora.getHours() + '-' + ahora.getMinutes();
    
    // Preparar filas de encabezado con datos del exportador
    const encabezado = [
      ["REPORTE DE PERSONAL"],
      ["Exportado por:", user?.nombre, "Rol:", user?.rol],
      ["Fecha y Hora:", ahora.toLocaleString()],
      [] // Fila vacía
    ];

    const dataCuerpo = empleados.map(emp => ({
      'Nombre Completo': emp.nombre,
      'Documento': emp.documento_id,
      'Correo': emp.email,
      'Rol': emp.rol,
      'Estado': emp.activo ? 'ACTIVO' : 'INACTIVO'
    }));

    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, encabezado, { origin: "A1" });
    XLSX.utils.sheet_add_json(ws, dataCuerpo, { origin: "A5", skipHeader: false });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empleados");
    
    XLSX.writeFile(wb, `listadoEmp_${fechaStr}_${horaStr}.xlsx`);
  };

  return (
    <main className="h-screen bg-[#050a14] text-white font-sans flex flex-col overflow-hidden">
      <div className="p-8 flex-none bg-[#050a14] z-10 border-b border-white/5">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Gestión de Empleados</h1>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="bg-emerald-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase">Exportar Excel</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 px-6 py-2 rounded-xl font-black text-[10px] uppercase">← Volver</button>
          </div>
        </header>

        <section className="bg-[#0f172a] p-6 rounded-[35px] border border-white/5 shadow-2xl">
          <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input type="text" placeholder="Nombre" className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-xs uppercase" value={editando ? editando.nombre : nuevo.nombre} onChange={(e) => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} required />
            <input type="text" placeholder="ID" className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-xs uppercase" value={editando ? editando.documento_id : nuevo.documento_id} onChange={(e) => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} required />
            <input type="email" placeholder="Correo" className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-xs" value={editando ? editando.email : nuevo.email} onChange={(e) => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} required />
            <input type="text" placeholder="PIN" className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-xs uppercase" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={(e) => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            <button type="submit" className="bg-blue-600 rounded-xl font-black text-[10px] uppercase">{editando ? 'Actualizar' : 'Registrar'}</button>
          </form>
        </section>
      </div>

      <div className="flex-1 overflow-y-auto p-8 pt-4">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-[#050a14] z-10">
            <tr className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] border-b border-white/5">
              <th className="pb-4 px-4">Empleado / Documento</th>
              <th className="pb-4 px-4">Contacto / PIN (Hover)</th>
              <th className="pb-4 px-4 text-center">Estado</th>
              <th className="pb-4 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {empleados.map(emp => (
              <tr key={emp.id} className="hover:bg-white/[0.02] group">
                <td className="py-5 px-4 font-bold text-sm uppercase">
                  {emp.nombre} <br/>
                  <span className="text-[9px] font-black text-slate-500">ID: {emp.documento_id}</span>
                </td>
                <td className="py-5 px-4">
                  <p className="text-xs text-slate-400">{emp.email}</p>
                  <div className="relative h-4 overflow-hidden">
                    <p className="text-[10px] font-black text-blue-500 uppercase transition-all duration-300 group-hover:-translate-y-full">PIN OCULTO</p>
                    <p className="text-[10px] font-black text-emerald-500 uppercase transition-all duration-300 translate-y-full group-hover:translate-y-0 absolute top-0">PIN: {emp.pin_seguridad}</p>
                  </div>
                </td>
                <td className="py-5 px-4 text-center">
                  <button onClick={() => toggleEstado(emp)} className={`px-5 py-1.5 rounded-lg font-black text-[9px] uppercase transition-all shadow-lg ${emp.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white' : 'bg-red-600 text-white shadow-red-900/40 hover:bg-red-500'}`}>
                    {emp.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="py-5 px-4 text-center">
                  <button onClick={() => setEditando(emp)} className="text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors">✏️ Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}