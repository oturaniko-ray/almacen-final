'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const [view, setView] = useState<'menu' | 'empleados' | 'movimientos'>('menu');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('empleados').select('*').order('nombre');
    setEmpleados(emps || []);
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
    setLogs(lg || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const toggleEstado = async (id: string, actual: boolean) => {
    await supabase.from('empleados').update({ activo: !actual }).eq('id', id);
    cargarDatos();
  };

  const guardarEmpleado = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nombre: fd.get('nombre'),
      documento_id: fd.get('doc'),
      pin_seguridad: fd.get('pin'),
      rol: fd.get('rol'),
      email: fd.get('email'),
      activo: true
    };

    if (editingEmp) {
      await supabase.from('empleados').update(payload).eq('id', editingEmp.id);
    } else {
      await supabase.from('empleados').insert([payload]);
    }
    setShowModal(false);
    setEditingEmp(null);
    cargarDatos();
  };

  if (view === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
        {/* PUNTO 1: Botón Volver al menú anterior (Login/Home) */}
        <button onClick={() => window.location.href = '/'} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold border border-white/10 hover:bg-slate-800 transition-all">← SALIR AL LOGIN</button>
        
        <h1 className="text-3xl font-black mb-12 text-blue-500 uppercase tracking-widest">Panel de Control</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <button onClick={() => setView('empleados')} className="p-12 bg-[#0f172a] hover:bg-blue-600 rounded-[40px] border border-white/5 transition-all group">
            <span className="text-5xl block mb-4 group-hover:scale-110 transition-transform">👥</span>
            <span className="text-xl font-black uppercase tracking-tight">Gestión de Empleados</span>
          </button>
          <button onClick={() => setView('movimientos')} className="p-12 bg-[#0f172a] hover:bg-emerald-600 rounded-[40px] border border-white/5 transition-all group">
            <span className="text-5xl block mb-4 group-hover:scale-110 transition-transform">📑</span>
            <span className="text-xl font-black uppercase tracking-tight">Movimientos de Acceso</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <button onClick={() => setView('menu')} className="text-slate-500 font-bold hover:text-white transition-colors">← VOLVER AL MENÚ</button>
          <h1 className="text-2xl font-black text-blue-500 uppercase tracking-widest">
            {view === 'empleados' ? 'Personal Registrado' : 'Historial de Movimientos'}
          </h1>
          <div className="flex gap-3">
            {/* PUNTO 4: Botón Nuevo Funcional */}
            {view === 'empleados' && (
              <button onClick={() => { setEditingEmp(null); setShowModal(true); }} className="px-5 py-2 bg-blue-600 rounded-xl font-bold text-sm shadow-lg hover:bg-blue-500 transition-all">+ NUEVO EMPLEADO</button>
            )}
            <button onClick={cargarDatos} className="px-5 py-2 bg-slate-800 rounded-xl font-bold text-sm flex items-center gap-2">
              {loading ? '...' : '🔄 ACTUALIZAR'}
            </button>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[35px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#1e293b] z-20 shadow-xl">
                <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                  {view === 'empleados' ? (
                    <>
                      <th className="p-6">Nombre</th><th className="p-6">Rol / Email</th><th className="p-6">Activo</th><th className="p-6">ID / PIN</th><th className="p-6">Acciones</th>
                    </>
                  ) : (
                    <>
                      <th className="p-6">Nombre</th><th className="p-6">Movimiento</th><th className="p-6">Fecha y Hora</th><th className="p-6">Método / Autorizó</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {view === 'empleados' ? empleados.map(emp => (
                  <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-6 font-bold flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${emp.en_almacen ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      {emp.nombre}
                    </td>
                    <td className="p-6 text-sm text-slate-400">{emp.rol}<br/><span className="text-[10px]">{emp.email}</span></td>
                    {/* PUNTO 3: Botón Activar/Desactivar */}
                    <td className="p-6">
                      <button onClick={() => toggleEstado(emp.id, emp.activo)} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${emp.activo ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                        {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </td>
                    {/* PUNTO 6: Cambio columna Ubicación por ID/PIN */}
                    <td className="p-6 text-xs font-mono text-blue-400">ID: {emp.documento_id}<br/>PIN: {emp.pin_seguridad}</td>
                    {/* PUNTO 3: Opción Editar */}
                    <td className="p-6">
                      <button onClick={() => { setEditingEmp(emp); setShowModal(true); }} className="text-blue-500 hover:text-white text-xs font-bold bg-blue-500/10 p-2 rounded-lg">EDITAR</button>
                    </td>
                  </tr>
                )) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors text-sm">
                    <td className="p-6 font-bold">{log.nombre_empleado}</td>
                    <td className="p-6">
                      <span className={`px-4 py-1 rounded-full text-[10px] font-black ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                        {log.tipo_movimiento?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-6 text-slate-400 text-xs">{new Date(log.fecha_hora).toLocaleString()}</td>
                    {/* PUNTO 8: Nombre de Supervisor en columna Autorizó */}
                    <td className="p-6 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{log.detalles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL PARA NUEVO / EDITAR */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <form onSubmit={guardarEmpleado} className="bg-[#0f172a] p-8 rounded-[40px] border border-white/10 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-black text-blue-500 mb-6 uppercase tracking-widest">{editingEmp ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
            <div className="space-y-4">
              <input name="nombre" defaultValue={editingEmp?.nombre} placeholder="Nombre Completo" className="w-full p-4 bg-[#050a14] rounded-xl outline-none border border-white/5 focus:border-blue-500" required />
              <div className="grid grid-cols-2 gap-4">
                <input name="doc" defaultValue={editingEmp?.documento_id} placeholder="ID Documento" className="p-4 bg-[#050a14] rounded-xl outline-none border border-white/5 focus:border-blue-500" required />
                <input name="pin" defaultValue={editingEmp?.pin_seguridad} placeholder="PIN 4 digitos" className="p-4 bg-[#050a14] rounded-xl outline-none border border-white/5 focus:border-blue-500" maxLength={4} required />
              </div>
              <input name="rol" defaultValue={editingEmp?.rol} placeholder="Cargo / Rol" className="w-full p-4 bg-[#050a14] rounded-xl outline-none border border-white/5 focus:border-blue-500" required />
              <input name="email" defaultValue={editingEmp?.email} type="email" placeholder="Email" className="w-full p-4 bg-[#050a14] rounded-xl outline-none border border-white/5 focus:border-blue-500" required />
            </div>
            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 p-4 bg-slate-800 rounded-2xl font-bold">CANCELAR</button>
              <button type="submit" className="flex-1 p-4 bg-blue-600 rounded-2xl font-bold">GUARDAR</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}