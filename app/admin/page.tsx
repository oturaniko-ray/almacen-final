'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react'; // Asegúrate de tener esta librería

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<'movimientos' | 'registro'>('movimientos');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState(''); 
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');

  const cargarDatos = useCallback(async () => {
    const { data: emps } = await supabase.from('empleados').select('*').order('nombre');
    setEmpleados(emps || []);
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
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
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between mb-8">
          <h1 className="text-2xl font-bold text-blue-500">ADMINISTRACIÓN</h1>
          <div className="flex gap-4">
            <button onClick={() => setView('movimientos')} className={`px-4 py-2 rounded-xl font-bold ${view === 'movimientos' ? 'bg-blue-600' : 'bg-slate-800'}`}>Movimientos</button>
            <button onClick={() => setView('registro')} className={`px-4 py-2 rounded-xl font-bold ${view === 'registro' ? 'bg-blue-600' : 'bg-slate-800'}`}>Personal</button>
            <button onClick={() => router.push('/')} className="px-4 py-2 bg-red-600/20 text-red-500 rounded-xl font-bold">Salir</button>
          </div>
        </div>

        {view === 'registro' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <form onSubmit={guardarEmpleado} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 space-y-4 h-fit">
              <h2 className="text-xl font-bold mb-4">{editId ? 'Editar' : 'Nuevo'} Empleado</h2>
              <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800" required />
              <input type="text" placeholder="Documento ID" value={documento} onChange={e => setDocumento(e.target.value)} className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800" required />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800" required />
              <input type="text" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800" required />
              <select value={rol} onChange={e => setRol(e.target.value)} className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800">
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
              <button className="w-full bg-blue-600 py-4 rounded-xl font-bold uppercase">Guardar</button>
            </form>

            <div className="md:col-span-2 space-y-4">
              {empleados.map(emp => (
                <div key={emp.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-lg">{emp.nombre}</p>
                    <p className="text-slate-500 text-sm">ID: {emp.documento_id} | Rol: {emp.rol}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    {/* QR GENERADO CON documento_id PARA QUE EL SUPERVISOR LO RECONOZCA */}
                    <div className="bg-white p-2 rounded-lg">
                      <QRCodeSVG value={`${emp.documento_id}|${emp.nombre}`} size={60} />
                    </div>
                    <button onClick={() => { setEditId(emp.id); setNombre(emp.nombre); setDocumento(emp.documento_id); setEmail(emp.email); setPin(emp.pin_seguridad); setRol(emp.rol); }} className="text-blue-500 font-bold">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-500 uppercase text-xs">
                <tr><th className="p-6">Empleado</th><th className="p-6">Tipo</th><th className="p-6">Fecha</th><th className="p-6">Detalles</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="p-6 font-bold">{log.nombre_empleado}</td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                        {log.tipo_movimiento?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-6 text-slate-400">{new Date(log.fecha_hora).toLocaleString()}</td>
                    <td className="p-6 text-sm italic text-slate-500">{log.detalles}</td>
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