'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);

  // Estados del formulario
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');

  useEffect(() => {
    const checkAuth = () => {
      const sessionStr = localStorage.getItem('user_session');
      if (!sessionStr) { router.push('/'); return; }
      const user = JSON.parse(sessionStr);
      if (user.rol !== 'admin') { router.push('/'); } 
      else { setAuthorized(true); cargarDatos(); }
    };
    checkAuth();
  }, [router]);

  async function cargarDatos() {
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false }).limit(50);
    setEmpleados(emps || []);
    setLogs(lg || []);
  }

  // Cargar datos en el formulario para editar
  const seleccionarEmpleado = (emp: any) => {
    setEditId(emp.id);
    setNombre(emp.nombre);
    setCedula(emp.cedula_id);
    setEmail(emp.email);
    setPin(emp.pin_seguridad);
    setRol(emp.rol);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function guardarEmpleado(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);

    const payload = { nombre, cedula_id: cedula, email, pin_seguridad: pin, rol, activo: true };

    let error;
    if (editId) {
      // MODO EDICIÓN
      const { error: upError } = await supabase.from('empleados').update(payload).eq('id', editId);
      error = upError;
    } else {
      // MODO CREACIÓN
      const { error: insError } = await supabase.from('empleados').insert([payload]);
      error = insError;
    }

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert(editId ? "Datos actualizados" : "Empleado creado");
      limpiarYRecargar();
    }
    setCargando(false);
  }

  const desactivarEmpleado = async (id: string) => {
    if (confirm("¿Seguro que desea dar de baja a este empleado? Podrá reactivarlo luego con su cédula.")) {
      await supabase.from('empleados').update({ activo: false }).eq('id', id);
      cargarDatos();
    }
  };

  const limpiarYRecargar = () => {
    setEditId(null);
    setNombre(''); setCedula(''); setEmail(''); setPin(''); setRol('empleado');
    cargarDatos();
  };

  if (!authorized) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando...</div>;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-slate-800 pb-6 gap-4">
          <h1 className="text-3xl font-bold text-blue-500">Panel Maestro</h1>
          <div className="flex gap-3">
            <button onClick={() => { localStorage.clear(); router.push('/'); }} className="bg-slate-800 hover:bg-red-600 px-4 py-2 rounded-lg text-sm transition-all">Cerrar Sesión</button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* COLUMNA 1: FORMULARIO (FIJO O SCROLLABLE) */}
          <section className="xl:col-span-1 space-y-6">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 sticky top-8">
              <h2 className="text-lg font-bold mb-4 text-blue-400">
                {editId ? '📝 Editando Empleado' : '➕ Nuevo Registro'}
              </h2>
              <form onSubmit={guardarEmpleado} className="space-y-4">
                <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none text-sm" required />
                <input type="text" placeholder="Cédula" value={cedula} onChange={e => setCedula(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none text-sm" required />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none text-sm" required />
                <input type="text" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none text-sm" required />
                <select value={rol} onChange={e => setRol(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 text-sm">
                  <option value="empleado">Empleado</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" disabled={cargando} className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold transition-all text-sm">
                    {editId ? 'Actualizar' : 'Guardar'}
                  </button>
                  {editId && (
                    <button type="button" onClick={limpiarYRecargar} className="bg-slate-700 px-4 rounded-lg">✕</button>
                  )}
                </div>
              </form>
            </div>
          </section>

          {/* COLUMNA 2 Y 3: GESTIÓN Y TABLAS */}
          <section className="xl:col-span-3 space-y-8">
            
            {/* SUBMENÚ: GESTIÓN DE EMPLEADOS (DESPLAZABLE) */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="font-bold text-emerald-400">👥 Gestión de Personal Actual</h2>
                <span className="text-xs text-slate-500 font-mono">{empleados.length} Registros</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 sticky top-0 z-10">
                    <tr className="text-slate-500 uppercase tracking-tighter border-b border-slate-800">
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Cédula</th>
                      <th className="p-4">PIN</th>
                      <th className="p-4">Rol</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {empleados.map(emp => (
                      <tr key={emp.id} className={`hover:bg-blue-500/5 transition-colors ${editId === emp.id ? 'bg-blue-500/10' : ''}`}>
                        <td className="p-4 font-semibold text-slate-200">{emp.nombre}</td>
                        <td className="p-4 font-mono text-slate-400">{emp.cedula_id}</td>
                        <td className="p-4 font-mono text-slate-400">{emp.pin_seguridad}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${emp.rol === 'admin' ? 'bg-purple-900 text-purple-300' : emp.rol === 'supervisor' ? 'bg-amber-900 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                            {emp.rol}
                          </span>
                        </td>
                        <td className="p-4 flex justify-center gap-2">
                          <button onClick={() => seleccionarEmpleado(emp)} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all">✏️</button>
                          <button onClick={() => desactivarEmpleado(emp.id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HISTORIAL DE LOGS (RESUMEN) */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h2 className="font-bold text-slate-400 mb-4">📜 Últimos Movimientos</h2>
              <div className="space-y-3">
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} className="flex justify-between items-center text-[11px] p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                    <span className="font-bold">{log.nombre_empleado}</span>
                    <span className="text-slate-500 font-mono">{new Date(log.fecha_hora).toLocaleString()}</span>
                    <span className={log.detalles?.includes('MANUAL') ? 'text-red-400' : 'text-blue-400'}>{log.detalles || 'QR'}</span>
                  </div>
                ))}
              </div>
            </div>

          </section>
        </div>
      </div>
    </main>
  );
}