'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<'movimientos' | 'registro'>('movimientos');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState(''); // Este es documento_id
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');

  const cargarDatos = useCallback(async () => {
    const { data: emps } = await supabase.from('empleados').select('*').order('nombre');
    setEmpleados(emps || []);
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false }).limit(100);
    setLogs(lg || []);
  }, []);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (session.rol === 'admin') { setAuthorized(true); cargarDatos(); }
    else router.push('/');
  }, [router, cargarDatos]);

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    // PAYLOAD ACTUALIZADO CON documento_id
    const payload = { 
      nombre, 
      documento_id: documento.trim(), 
      email, 
      pin_seguridad: pin.trim(), 
      rol, 
      activo: true 
    };
    
    if (editId) {
      await supabase.from('empleados').update(payload).eq('id', editId);
    } else {
      await supabase.from('empleados').insert([payload]);
    }
    
    setEditId(null); setNombre(''); setDocumento(''); setEmail(''); setPin(''); setRol('empleado');
    cargarDatos();
    alert("Empleado guardado correctamente");
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between mb-8 items-center">
          <h1 className="text-xl font-bold text-blue-500 uppercase tracking-tighter">Admin Panel</h1>
          <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setView('movimientos')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${view === 'movimientos' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>HISTORIAL</button>
            <button onClick={() => setView('registro')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${view === 'registro' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>PERSONAL</button>
          </div>
        </div>

        {view === 'registro' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <form onSubmit={guardarEmpleado} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 h-fit shadow-xl">
              <h2 className="text-sm font-bold text-slate-400 mb-4 uppercase">{editId ? 'Editar' : 'Nuevo'} Empleado</h2>
              <input type="text" placeholder="Nombre Completo" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500" required />
              <input type="text" placeholder="ID Documento (Alfanumérico)" value={documento} onChange={e => setDocumento(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500" required />
              <input type="email" placeholder="Correo Electrónico" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500" required />
              <input type="text" placeholder="PIN de Acceso" value={pin} onChange={e => setPin(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500" required />
              <select value={rol} onChange={e => setRol(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none">
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
              <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-xs uppercase shadow-lg transition-all">Guardar Cambios</button>
              {editId && <button type="button" onClick={() => { setEditId(null); setNombre(''); setDocumento(''); setEmail(''); setPin(''); }} className="w-full text-slate-500 text-[10px] uppercase">Cancelar Edición</button>}
            </form>

            <div className="md:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-500 uppercase">
                    <tr>
                      <th className="p-5">Empleado</th>
                      <th className="p-5">Documento ID</th>
                      <th className="p-5">Rol</th>
                      <th className="p-5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {empleados.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-5">
                          <div className="font-bold">{emp.nombre}</div>
                          <div className="text-[10px] text-slate-500">{emp.email}</div>
                        </td>
                        <td className="p-5 font-mono text-blue-400">{emp.documento_id}</td>
                        <td className="p-5"><span className="px-2 py-1 bg-slate-800 rounded text-[9px] uppercase">{emp.rol}</span></td>
                        <td className="p-5 text-right">
                          <button onClick={() => { setEditId(emp.id); setNombre(emp.nombre); setDocumento(emp.documento_id); setEmail(emp.email); setPin(emp.pin_seguridad); setRol(emp.rol); }} className="text-blue-500 hover:text-blue-400 font-bold">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-500 uppercase font-bold">
                <tr><th className="p-5">Empleado</th><th className="p-5">Tipo</th><th className="p-5">Fecha / Hora</th><th className="p-5">Supervisor / Detalles</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-5 font-bold">{log.nombre_empleado}</td>
                    <td className="p-5">
                      <span className={`px-2 py-1 rounded-full text-[9px] font-black ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {log.tipo_movimiento?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-5 text-slate-400">{new Date(log.fecha_hora).toLocaleString()}</td>
                    <td className="p-5 italic text-[10px] text-slate-500">{log.detalles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}