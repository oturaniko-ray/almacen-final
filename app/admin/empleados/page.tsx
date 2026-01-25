'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionEmpleados() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [mostrarPinId, setMostrarPinId] = useState<string | null>(null);
  const [editando, setEditando] = useState<any>(null);
  const [nuevo, setNuevo] = useState({ nombre: '', documento_id: '', email: '', pin_seguridad: '', rol: 'empleado', activo: true });
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);
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
    const nuevoEstado = !emp.activo;
    const { error } = await supabase.from('empleados').update({ 
      activo: nuevoEstado,
      fecha_inactividad: nuevoEstado ? null : new Date().toISOString() 
    }).eq('id', emp.id);
    if (!error) fetchEmpleados();
  };

  const exportarExcel = () => {
    const dataExcel = empleados.map(emp => ({
      'Nombre Completo': emp.nombre,
      'Documento': emp.documento_id,
      'Correo': emp.email,
      'Rol': emp.rol,
      'Estado': emp.activo ? 'Activo' : 'Inactivo',
      'Fecha Ingreso': emp.created_at ? new Date(emp.created_at).toLocaleDateString() : '---',
      'Fecha Inactividad': emp.fecha_inactividad ? new Date(emp.fecha_inactividad).toLocaleDateString() : '---'
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empleados");

    // Metadatos de exportación
    XLSX.utils.sheet_add_aoa(ws, [
      ["Exportado por:", user?.nombre, "Rol:", user?.rol],
      ["Fecha/Hora Exportación:", new Date().toLocaleString()]
    ], { origin: -1 });

    XLSX.writeFile(wb, `Reporte_Empleados_${new Date().getTime()}.xlsx`);
  };

  return (
    <main className="h-screen bg-[#050a14] text-white font-sans flex flex-col overflow-hidden">
      {/* SECCIÓN FIJA: HEADER Y FORMULARIO */}
      <div className="p-8 flex-none border-b border-white/5 shadow-2xl z-10 bg-[#050a14]">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Gestión de Empleados</h1>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="bg-emerald-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase">Exportar Excel</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 px-5 py-2 rounded-xl font-black text-[10px] uppercase">← Volver</button>
          </div>
        </header>

        <section className="bg-[#0f172a] p-6 rounded-[35px] border border-white/5">
          <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="Nombre" className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-sm" value={editando ? editando.nombre : nuevo.nombre} onChange={(e) => editando ? setEditando({...editando, nombre: e.target.value}) : setNuevo({...nuevo, nombre: e.target.value})} required />
            <input type="text" placeholder="Documento" className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-sm" value={editando ? editando.documento_id : nuevo.documento_id} onChange={(e) => editando ? setEditando({...editando, documento_id: e.target.value}) : setNuevo({...nuevo, documento_id: e.target.value})} required />
            <input type="email" placeholder="Correo" className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-sm" value={editando ? editando.email : nuevo.email} onChange={(e) => editando ? setEditando({...editando, email: e.target.value}) : setNuevo({...nuevo, email: e.target.value})} required />
            <input type="text" placeholder="PIN" className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-sm" value={editando ? editando.pin_seguridad : nuevo.pin_seguridad} onChange={(e) => editando ? setEditando({...editando, pin_seguridad: e.target.value}) : setNuevo({...nuevo, pin_seguridad: e.target.value})} required />
            <select className="bg-[#050a14] border border-white/10 p-3 rounded-xl text-sm" value={editando ? editando.rol : nuevo.rol} onChange={(e) => editando ? setEditando({...editando, rol: e.target.value}) : setNuevo({...nuevo, rol: e.target.value})}>
              <option value="empleado">Empleado</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </select>
            <button type="submit" className="bg-blue-600 rounded-xl font-black text-[10px] uppercase">{editando ? 'Actualizar' : 'Registrar'}</button>
          </form>
        </section>
      </div>

      {/* SECCIÓN SCROLL: TABLA */}
      <div className="flex-1 overflow-y-auto p-8 pt-4">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-[#050a14] z-10">
            <tr className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-white/5">
              <th className="pb-4 px-4">Empleado</th>
              <th className="pb-4 px-4">Contacto / PIN</th>
              <th className="pb-4 px-4">Rol</th>
              <th className="pb-4 px-4">Estado</th>
              <th className="pb-4 px-4">Edición</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {empleados.map(emp => (
              <tr key={emp.id} className="hover:bg-white/[0.02]">
                <td className="py-5 px-4 font-bold uppercase text-sm">{emp.nombre}</td>
                <td className="py-5 px-4">
                  <p className="text-sm">{emp.email}</p>
                  <button onClick={() => setMostrarPinId(mostrarPinId === emp.id ? null : emp.id)} className="text-[10px] font-bold text-blue-500 uppercase mt-1">
                    {mostrarPinId === emp.id ? `PIN: ${emp.pin_seguridad}` : 'Ver PIN oculto'}
                  </button>
                </td>
                <td className="py-5 px-4 text-[10px] font-black uppercase text-slate-400">{emp.rol}</td>
                <td className="py-5 px-4">
                  <button onClick={() => toggleEstado(emp)} className={`px-4 py-1 rounded-md font-black text-[10px] uppercase transition-all ${emp.activo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500 text-white'}`}>
                    {emp.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="py-5 px-4">
                  <button onClick={() => setEditando(emp)} className="text-[10px] font-black uppercase text-slate-400 hover:text-white">✏️ Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}