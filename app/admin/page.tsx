'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<'movimientos' | 'registro'>('movimientos');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Filtros
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  // Formulario de Empleados
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');

  const cargarDatos = useCallback(async () => {
    // 1. Cargar Empleados
    const { data: emps } = await supabase.from('empleados').select('*').order('nombre');
    setEmpleados(emps || []);

    // 2. Cargar Movimientos (Logs)
    let query = supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false }).limit(200);
    
    if (desde) query = query.gte('fecha_hora', `${desde}T00:00:00`);
    if (hasta) query = query.lte('fecha_hora', `${hasta}T23:59:59`);

    const { data: lg } = await query;
    setLogs(lg || []);
    setLastUpdate(new Date());
  }, [desde, hasta]);

  // VALIDACIÓN DE SEGURIDAD
  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) {
      router.push('/');
      return;
    }

    const session = JSON.parse(sessionStr);
    if (session.rol === 'admin') {
      setAuthorized(true);
      setLoadingAuth(false);
      cargarDatos();

      // INTERVALO DE REFRESCO AUTOMÁTICO (30 SEGUNDOS)
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
    
    if (editId) {
      await supabase.from('empleados').update(payload).eq('id', editId);
    } else {
      await supabase.from('empleados').insert([payload]);
    }
    
    limpiarForm();
    cargarDatos();
    alert("Proceso completado");
  };

  const toggleEstado = async (id: string, activo: boolean) => {
    await supabase.from('empleados').update({ activo: !activo }).eq('id', id);
    cargarDatos();
  };

  const limpiarForm = () => {
    setEditId(null); setNombre(''); setCedula(''); setEmail(''); setPin(''); setRol('empleado');
  };

  if (loadingAuth || !authorized) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Verificando Credenciales...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* BARRA DE ESTADO */}
        <div className="flex justify-between items-center mb-4 px-2">
          <h1 className="text-xl font-bold text-blue-500">Panel Admin</h1>
          <span className="text-[10px] font-mono text-slate-500">
            📡 ÚLTIMA SINCRONIZACIÓN: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>

        {/* NAVEGACIÓN INTERNA */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-slate-800 pb-6">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setView('movimientos')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${view === 'movimientos' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>MOVIMIENTOS</button>
            <button onClick={() => setView('registro')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${view === 'registro' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>GESTIÓN DE PERSONAL</button>
          </div>
          <button onClick={() => router.push('/')} className="text-slate-400 text-xs hover:text-white transition-colors underline">Regresar al Menú Principal</button>
        </header>

        {view === 'movimientos' ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* FILTROS DE FECHA */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex gap-4 items-center flex-wrap">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Filtrar por fecha:</span>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-blue-500" />
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-blue-500" />
              <button onClick={cargarDatos} className="bg-blue-600 px-6 py-2 rounded text-xs font-bold hover:bg-blue-500">ACTUALIZAR</button>
            </div>

            {/* TABLA DE LOGS */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500 uppercase tracking-widest">
                  <tr>
                    <th className="p-4">Empleado</th>
                    <th className="p-4 text-center">Tipo</th>
                    <th className="p-4">Fecha / Hora</th>
                    <th className="p-4">Hardware</th>
                    <th className="p-4">Validado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/20 transition-all">
                      <td className="p-4 font-bold text-slate-200">{log.nombre_empleado}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                          {log.tipo_movimiento}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-mono">{new Date(log.fecha_hora).toLocaleString()}</td>
                      <td className="p-4 italic text-slate-500">{log.detalles?.split('-')[0] || 'N/A'}</td>
                      <td className="p-4 text-blue-400 font-bold">{log.detalles?.split('Por:')[1] || 'SISTEMA'}</td>
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
              <h2 className="text-blue-400 font-bold mb-4 uppercase text-xs tracking-tighter">{editId ? 'Modificar Empleado' : 'Nuevo Registro'}</h2>
              <form onSubmit={guardarEmpleado} className="space-y-3">
                <input type="text" placeholder="Nombre Completo" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm" required />
                <input type="text" placeholder="ID / Cédula" value={cedula} onChange={e => setCedula(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm" required />
                <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm" required />
                <input type="text" placeholder="PIN de Acceso" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm" required />
                <select value={rol} onChange={e => setRol(e.target.value)} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm">
                  <option value="empleado">Empleado</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
                <button className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold text-sm transition-all shadow-lg">GUARDAR PERSONAL</button>
                {editId && <button onClick={limpiarForm} className="w-full text-slate-500 text-[10px] mt-2 underline">Cancelar Edición</button>}
              </form>
            </div>

            {/* TABLA DE PERSONAL */}
            <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500">
                  <tr>
                    <th className="p-4">Nombre / Cédula</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4">Registro</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {empleados.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-800/10 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-200">{emp.nombre}</div>
                        <div className="text-slate-500 font-mono text-[10px]">{emp.cedula_id}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full font-black text-[9px] border ${emp.activo ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-red-500/30 text-red-500 bg-red-500/5'}`}>
                          {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-400 font-mono">{new Date(emp.created_at || new Date()).toLocaleDateString()}</div>
                        <div className="text-[9px] text-blue-500 font-bold italic tracking-tighter uppercase">Empleado Creado</div>
                      </td>
                      <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => { setEditId(emp.id); setNombre(emp.nombre); setCedula(emp.cedula_id); setEmail(emp.email); setPin(emp.pin_seguridad); setRol(emp.rol); }} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all">✏️</button>
                        <button onClick={() => toggleEstado(emp.id, emp.activo)} className={`px-3 py-1 rounded-lg font-bold text-[9px] border transition-all ${emp.activo ? 'border-red-500/50 text-red-500 hover:bg-red-600 hover:text-white' : 'border-emerald-500/50 text-emerald-500 hover:bg-emerald-600 hover:text-white'}`}>
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