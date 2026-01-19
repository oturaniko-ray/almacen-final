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
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Filtros
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  // Formulario
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');

  // CARGAR DATOS (Memorizado para el intervalo)
  const cargarDatos = useCallback(async () => {
    // Empleados
    const { data: emps } = await supabase.from('empleados').select('*').order('nombre');
    setEmpleados(emps || []);

    // Movimientos
    let query = supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false }).limit(100);
    
    if (desde) query = query.gte('fecha_hora', `${desde}T00:00:00`);
    if (hasta) query = query.lte('fecha_hora', `${hasta}T23:59:59`);

    const { data: lg } = await query;
    setLogs(lg || []);
    setLastUpdate(new Date());
  }, [desde, hasta]);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (session.rol === 'admin') {
      setAuthorized(true);
      cargarDatos();

      // AUTO-REFRESCO CADA 30 SEGUNDOS
      const interval = setInterval(() => {
        cargarDatos();
      }, 30000);

      return () => clearInterval(interval);
    } else {
      router.push('/');
    }
  }, [router, cargarDatos]);

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nombre, cedula_id: cedula, email, pin_seguridad: pin, rol, activo: true };
    if (editId) await supabase.from('empleados').update(payload).eq('id', editId);
    else await supabase.from('empleados').insert([payload]);
    
    limpiarForm();
    cargarDatos();
    alert("Datos guardados con éxito");
  };

  const toggleEstado = async (id: string, activo: boolean) => {
    await supabase.from('empleados').update({ activo: !activo }).eq('id', id);
    cargarDatos();
  };

  const limpiarForm = () => {
    setEditId(null); setNombre(''); setCedula(''); setEmail(''); setPin(''); setRol('empleado');
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* INDICADOR DE REFRESCADO */}
        <div className="flex justify-end mb-2">
          <span className="text-[9px] font-mono text-slate-600 bg-slate-900 px-2 py-1 rounded">
            📡 ACTUALIZADO: {lastUpdate.toLocaleTimeString()} (Sincronizando cada 30s)
          </span>
        </div>

        {/* CABECERA */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-slate-800 pb-6">
          <h1 className="text-2xl font-bold text-blue-500">Panel Maestro</h1>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setView('movimientos')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'movimientos' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>📊 MOVIMIENTOS</button>
            <button onClick={() => setView('registro')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'registro' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>👤 REGISTRO / PERSONAL</button>
          </div>
          <button onClick={() => router.push('/')} className="bg-slate-800 px-4 py-2 rounded-lg text-xs">Menú Principal</button>
        </header>

        {view === 'movimientos' ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* FILTROS */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex gap-4 items-end">
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-2 text-xs" />
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-2 text-xs" />
              <button onClick={cargarDatos} className="bg-blue-600 px-4 py-2 rounded text-xs font-bold">FILTRAR</button>
            </div>

            {/* TABLA */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase">
                  <tr>
                    <th className="p-4">Empleado</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Fecha / Hora</th>
                    <th className="p-4">Método</th>
                    <th className="p-4">Supervisor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/20">
                      <td className="p-4 font-bold">{log.nombre_empleado}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {log.tipo_movimiento.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-mono">{new Date(log.fecha_hora).toLocaleString()}</td>
                      <td className="p-4 italic text-slate-500">{log.detalles?.split('-')[0] || '---'}</td>
                      <td className="p-4 text-blue-400 font-medium">{log.detalles?.split('Por:')[1] || 'SISTEMA'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-500">
            {/* FORMULARIO */}
            <div className="lg:col-span-1 bg-slate-900 p-6 rounded-2xl border border-slate-800 h-fit">
              <h2 className="text-blue-400 font-bold mb-4 uppercase text-xs">{editId ? 'Editar' : 'Nuevo Registro'}</h2>
              <form onSubmit={guardarEmpleado} className="space-y-3">
                <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm" required />
                <input type="text" placeholder="Cédula" value={cedula} onChange={e => setCedula(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm" required />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm" required />
                <input type="text" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm" required />
                <select value={rol} onChange={e => setRol(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm">
                  <option value="empleado">Empleado</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="w-full bg-blue-600 py-3 rounded-lg font-bold text-sm">GUARDAR</button>
                {editId && <button onClick={limpiarForm} className="w-full text-slate-500 text-[10px] mt-2">CANCELAR EDICIÓN</button>}
              </form>
            </div>

            {/* GESTIÓN DE PERSONAL */}
            <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500">
                  <tr>
                    <th className="p-4">Nombre / ID</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Creación</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {empleados.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-800/10 transition-colors">
                      <td className="p-4">
                        <div className="font-bold">{emp.nombre}</div>
                        <div className="text-slate-500 font-mono text-[10px]">{emp.cedula_id}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] border ${emp.activo ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-red-500/30 text-red-500 bg-red-500/5'}`}>
                          {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-400">{new Date(emp.created_at || new Date()).toLocaleDateString()}</div>
                        <div className="text-[9px] text-blue-500 font-bold italic">CREADO</div>
                      </td>
                      <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => { setEditId(emp.id); setNombre(emp.nombre); setCedula(emp.cedula_id); setEmail(emp.email); setPin(emp.pin_seguridad); setRol(emp.rol); }} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all">✏️</button>
                        <button onClick={() => toggleEstado(emp.id, emp.activo)} className={`px-3 py-1 rounded-lg font-bold text-[9px] ${emp.activo ? 'bg-red-500/10 text-red-500 hover:bg-red-600' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-600'} hover:text-white transition-all`}>
                          {emp.activo ? 'DESACTIVAR' : 'ACTIVAR'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}