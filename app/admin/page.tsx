'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<'movimientos' | 'registro'>('movimientos');
  const [logs, setLogs] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const router = useRouter();

  // Función de carga memorizada para evitar re-renderizados infinitos
  const cargarDatos = useCallback(async () => {
    console.log("Actualizando datos desde base de datos...");
    const { data: emps } = await supabase.from('empleados').select('*').order('nombre');
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false }).limit(100);
    
    setEmpleados(emps || []);
    setLogs(lg || []);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (session.rol === 'admin') {
      setAuthorized(true);
      cargarDatos();

      // --- AUTO-REFRESCO CADA 30 SEGUNDOS ---
      const interval = setInterval(() => {
        cargarDatos();
      }, 30000); 

      return () => clearInterval(interval);
    } else {
      router.push('/');
    }
  }, [router, cargarDatos]);

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Barra de estado de actualización */}
        <div className="flex justify-end mb-2">
          <span className="text-[10px] text-slate-600 font-mono animate-pulse">
            Última actualización: {lastUpdate.toLocaleTimeString()} (Auto-refresco 30s)
          </span>
        </div>

        {/* ... Resto de tu código de Administrador (Tabla, Filtros, etc.) ... */}
        {/* Mantén aquí la estructura de botones que ya teníamos */}
      </div>
    </main>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<'movimientos' | 'registro'>('movimientos');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  
  // Filtros de fecha
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  // Estados del formulario
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (session.rol === 'admin') {
      setAuthorized(true);
      cargarDatos();
    } else {
      router.push('/');
    }
  }, [router]);

  async function cargarDatos() {
    // Cargar todos los empleados (incluyendo inactivos para el historial)
    const { data: emps } = await supabase.from('empleados').select('*').order('nombre');
    setEmpleados(emps || []);

    let query = supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
    
    if (desde) query = query.gte('fecha_hora', `${desde}T00:00:00`);
    if (hasta) query = query.lte('fecha_hora', `${hasta}T23:59:59`);

    const { data: lg } = await query;
    setLogs(lg || []);
  }

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
    alert("Operación exitosa");
  };

  const toggleEstado = async (id: string, estadoActual: boolean) => {
    await supabase.from('empleados').update({ activo: !estadoActual }).eq('id', id);
    cargarDatos();
  };

  const limpiarForm = () => {
    setEditId(null); setNombre(''); setCedula(''); setEmail(''); setPin(''); setRol('empleado');
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* ENCABEZADO Y SUBMENÚ */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-slate-800 pb-6">
          <h1 className="text-2xl font-bold text-blue-500">Sistema de Control Almacén</h1>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button 
              onClick={() => setView('movimientos')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'movimientos' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              📊 Movimientos
            </button>
            <button 
              onClick={() => setView('registro')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'registro' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              👤 Registro y Personal
            </button>
          </div>
          <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-red-400 text-xs font-bold bg-red-400/10 px-4 py-2 rounded-lg">Cerrar Sesión</button>
        </header>

        {view === 'movimientos' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* FILTROS */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1 font-bold uppercase">Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1 font-bold uppercase">Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm outline-none" />
              </div>
              <button onClick={cargarDatos} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold">Filtrar</button>
            </div>

            {/* TABLA DE MOVIMIENTOS */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-500">
                  <tr className="border-b border-slate-800">
                    <th className="p-4">Empleado</th>
                    <th className="p-4">Movimiento</th>
                    <th className="p-4">Fecha / Hora</th>
                    <th className="p-4">Tipo Entrada</th>
                    <th className="p-4">Validado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-bold">{log.nombre_empleado}</td>
                      <td className="p-4 uppercase text-[10px]">
                        <span className={`px-2 py-1 rounded-md ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {log.tipo_movimiento}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-mono">{new Date(log.fecha_hora).toLocaleString()}</td>
                      <td className="p-4 italic text-slate-500">{log.detalles?.split('-')[0] || '---'}</td>
                      <td className="p-4 font-medium text-blue-400">{log.detalles?.split('Por:')[1] || 'Sistema'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4">
            {/* FORMULARIO */}
            <section className="lg:col-span-1">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 sticky top-4">
                <h2 className="text-blue-400 font-bold mb-4">{editId ? 'Editar Empleado' : 'Nuevo Registro'}</h2>
                <form onSubmit={guardarEmpleado} className="space-y-3 text-sm">
                  <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700" required />
                  <input type="text" placeholder="Cédula" value={cedula} onChange={e => setCedula(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700" required />
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700" required />
                  <input type="text" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700" required />
                  <select value={rol} onChange={e => setRol(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700">
                    <option value="empleado">Empleado</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="w-full bg-blue-600 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/40">Guardar</button>
                  {editId && <button onClick={limpiarForm} className="w-full text-slate-500 text-xs">Cancelar edición</button>}
                </form>
              </div>
            </section>

            {/* TABLA DE EMPLEADOS / GESTIÓN */}
            <section className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                <h3 className="font-bold text-slate-400">Personal Registrado</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-500">
                    <tr className="border-b border-slate-800">
                      <th className="p-4">Nombre / Cédula</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4">Fecha Creación</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {empleados.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-800/20">
                        <td className="p-4">
                          <p className="font-bold">{emp.nombre}</p>
                          <p className="text-slate-500 font-mono text-[10px]">{emp.cedula_id}</p>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${emp.activo ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                            {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="text-slate-400 font-mono">{new Date(emp.created_at).toLocaleDateString()}</p>
                          <p className="text-[9px] text-blue-500 font-bold uppercase italic">CREADO</p>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => { setEditId(emp.id); setNombre(emp.nombre); setCedula(emp.cedula_id); setEmail(emp.email); setPin(emp.pin_seguridad); setRol(emp.rol); }} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all">✏️</button>
                            <button onClick={() => toggleEstado(emp.id, emp.activo)} className={`p-2 rounded-lg font-bold text-[10px] ${emp.activo ? 'bg-red-500/10 text-red-400 hover:bg-red-500' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500'} hover:text-white transition-all`}>
                              {emp.activo ? 'DESACTIVAR' : 'ACTIVAR'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}