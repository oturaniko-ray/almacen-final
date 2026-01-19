'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

// Inicialización segura de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);

  // Estados del formulario
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState('empleado');

  useEffect(() => {
    // 1. Verificación de seguridad montada (Evita errores de hidratación)
    const checkAuth = () => {
      const sessionStr = localStorage.getItem('user_session');
      if (!sessionStr) {
        router.push('/');
        return;
      }
      const user = JSON.parse(sessionStr);
      if (user.rol !== 'admin') {
        alert("Acceso denegado: Se requieren permisos de administrador.");
        router.push('/');
      } else {
        setAuthorized(true);
        cargarDatos();
      }
    };

    checkAuth();
  }, [router]);

  async function cargarDatos() {
    try {
      const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
      const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
      setEmpleados(emps || []);
      setLogs(lg || []);
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
  }

  async function crearEmpleado(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    
    const { error } = await supabase.from('empleados').insert([
      { nombre, cedula_id: cedula, email, pin_seguridad: pin, rol, activo: true }
    ]);

    if (error && error.code === '23505') {
      if (confirm("Esta cédula ya existe. ¿Desea reactivar a este empleado?")) {
        await supabase.from('empleados').update({ nombre, email, pin_seguridad: pin, rol, activo: true }).eq('cedula_id', cedula);
        alert("Empleado actualizado/reactivado.");
        limpiarYRecargar();
      }
    } else if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Empleado creado con éxito");
      limpiarYRecargar();
    }
    setCargando(false);
  }

  const limpiarYRecargar = () => {
    setNombre(''); setCedula(''); setEmail(''); setPin(''); setRol('empleado');
    cargarDatos();
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Asistencia");
    XLSX.writeFile(wb, "Reporte_Almacen.xlsx");
  };

  // Si no está autorizado, no renderizamos nada para evitar parpadeos
  if (!authorized) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Verificando credenciales...</div>;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-slate-800 pb-6 gap-4">
          <h1 className="text-3xl font-bold text-blue-500 tracking-tight">Panel de Administración</h1>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-700 px-6 py-2 rounded-lg font-bold transition-all shadow-lg shadow-emerald-900/20">
              📥 Exportar Excel
            </button>
            <button onClick={() => { localStorage.clear(); router.push('/'); }} className="bg-slate-800 hover:bg-red-900 px-4 py-2 rounded-lg text-sm transition-all">
              Salir
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FORMULARIO */}
          <section className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl h-fit">
            <h2 className="text-xl font-semibold mb-6 text-blue-400 flex items-center gap-2">👤 Registro</h2>
            <form onSubmit={crearEmpleado} className="space-y-4">
              <input type="text" placeholder="Nombre Completo" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" required />
              <input type="text" placeholder="Cédula (Contraseña)" value={cedula} onChange={e => setCedula(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" required />
              <input type="email" placeholder="Correo Electrónico" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" required />
              <input type="text" placeholder="PIN Seguridad (4 dígitos)" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" required />
              <select value={rol} onChange={e => setRol(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 text-white outline-none">
                <option value="empleado">Rol: Empleado</option>
                <option value="supervisor">Rol: Supervisor</option>
                <option value="admin">Rol: Administrador</option>
              </select>
              <button disabled={cargando} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition-all disabled:opacity-50">
                {cargando ? 'Procesando...' : 'Guardar Empleado'}
              </button>
            </form>
          </section>

          {/* TABLA DE MOVIMIENTOS */}
          <section className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <h2 className="text-xl font-semibold mb-6 text-emerald-400">📋 Historial Reciente</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="pb-4 px-2">Empleado</th>
                    <th className="pb-4 px-2">Fecha/Hora</th>
                    <th className="pb-4 px-2">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-2 font-medium">{log.nombre_empleado}</td>
                      <td className="py-4 px-2 text-slate-400">{new Date(log.fecha_hora).toLocaleString()}</td>
                      <td className="py-4 px-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${log.detalles?.includes('MANUAL') ? 'bg-red-900/40 text-red-400' : 'bg-blue-900/40 text-blue-400'}`}>
                          {log.detalles || 'QR NORMAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && <p className="text-center py-10 text-slate-600 italic">No hay registros hoy</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}