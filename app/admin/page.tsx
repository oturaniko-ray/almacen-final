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
  
  // Formulario alfanumérico
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
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
    const payload = { nombre, documento_id: documento.trim(), email, pin_seguridad: pin.trim(), rol, activo: true };
    
    if (editId) await supabase.from('empleados').update(payload).eq('id', editId);
    else await supabase.from('empleados').insert([payload]);
    
    setEditId(null); setNombre(''); setDocumento(''); setEmail(''); setPin(''); setRol('empleado');
    cargarDatos();
    alert("Operación exitosa");
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between mb-8">
          <h1 className="text-xl font-bold text-blue-500 uppercase">Panel Administrativo</h1>
          <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button onClick={() => setView('movimientos')} className={`px-4 py-2 rounded text-xs ${view === 'movimientos' ? 'bg-blue-600' : ''}`}>MOVIMIENTOS</button>
            <button onClick={() => setView('registro')} className={`px-4 py-2 rounded text-xs ${view === 'registro' ? 'bg-blue-600' : ''}`}>EMPLEADOS</button>
          </div>
        </div>

        {view === 'registro' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <form onSubmit={guardarEmpleado} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 h-fit">
              <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm" required />
              <input type="text" placeholder="Documento ID (Alfanumérico)" value={documento} onChange={e => setDocumento(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm" required />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm" required />
              <input type="text" placeholder="PIN Alfanumérico" value={pin} onChange={e => setPin(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm" required />
              <select value={rol} onChange={e => setRol(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm">
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
              <button className="w-full bg-blue-600 py-3 rounded-lg font-bold text-sm uppercase">Guardar</button>
            </form>

            <div className="md:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr><th className="p-4">Nombre</th><th className="p-4">Documento</th><th className="p-4">Rol</th><th className="p-4">Acciones</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {empleados.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-800/20">
                      <td className="p-4 font-bold">{emp.nombre}</td>
                      <td className="p-4 font-mono">{emp.documento_id}</td>
                      <td className="p-4 uppercase">{emp.rol}</td>
                      <td className="p-4"><button onClick={() => { setEditId(emp.id); setNombre(emp.nombre); setDocumento(emp.documento_id); setEmail(emp.email); setPin(emp.pin_seguridad); setRol(emp.rol); }} className="text-blue-500">Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-500">
                <tr><th className="p-4">Empleado</th><th className="p-4">Movimiento</th><th className="p-4">Fecha</th><th className="p-4">Detalles</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="p-4 font-bold">{log.nombre_empleado}</td>
                    <td className="p-4 capitalize">{log.tipo_movimiento}</td>
                    <td className="p-4 text-slate-400">{new Date(log.fecha_hora).toLocaleString()}</td>
                    <td className="p-4 italic text-[10px] text-blue-400">{log.detalles}</td>
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