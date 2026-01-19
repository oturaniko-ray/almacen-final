'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [pin, setPin] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true);
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
    setEmpleados(emps || []);
    setLogs(lg || []);
  }

  async function crearEmpleado(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.from('empleados').insert([
      { nombre, cedula_id: cedula, pin_seguridad: pin, activo: true }
    ]);
    
    if (error) alert("Error al crear: " + error.message);
    else {
      setNombre(''); setCedula(''); setPin('');
      cargarDatos();
    }
    setCargando(false);
  }

  async function eliminarEmpleado(id: string) {
    if (confirm("¿Desactivar este empleado?")) {
      await supabase.from('empleados').update({ activo: false }).eq('id', id);
      cargarDatos();
    }
  }

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Accesos");
    XLSX.writeFile(wb, "Reporte_Asistencia.xlsx");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold text-blue-500">Panel Maestro Almacén</h1>
          <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-700 px-6 py-2 rounded-lg font-bold transition-all">
            📥 Exportar Excel
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SECCIÓN 1: GESTIÓN DE EMPLEADOS (ESTO ES LO QUE FALTABA) */}
          <section className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h2 className="text-xl font-semibold mb-6 text-blue-400">👤 Registro de Empleados</h2>
            <form onSubmit={crearEmpleado} className="space-y-4">
              <input type="text" placeholder="Nombre Completo" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" required />
              <input type="text" placeholder="Cédula / ID de Usuario" value={cedula} onChange={e => setCedula(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" required />
              <input type="text" placeholder="PIN (4-6 dígitos)" value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700 focus:border-blue-500 outline-none" required />
              <button disabled={cargando} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition-all">
                {cargando ? 'Guardando...' : 'Registrar Empleado'}
              </button>
            </form>

            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Lista Activa</h3>
              {empleados.map(emp => (
                <div key={emp.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div>
                    <p className="font-bold text-sm">{emp.nombre}</p>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {emp.cedula_id} | PIN: {emp.pin_seguridad}</p>
                  </div>
                  <button onClick={() => eliminarEmpleado(emp.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all">
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* SECCIÓN 2: HISTORIAL DE ACCESOS */}
          <section className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <h2 className="text-xl font-semibold mb-6 text-emerald-400">📋 Historial de Movimientos</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-4">Empleado</th>
                    <th className="pb-4">Fecha/Hora</th>
                    <th className="pb-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 font-medium">{log.nombre_empleado}</td>
                      <td className="py-4 text-slate-400">{new Date(log.fecha_hora).toLocaleString()}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                          {log.tipo_movimiento.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}