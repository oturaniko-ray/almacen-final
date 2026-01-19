'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { UserPlus, Trash2, FileSpreadsheet, ShieldAlert } from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminDashboard() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCedula, setNuevaCedula] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true);
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
    setEmpleados(emps || []);
    setLogs(lg || []);
  }

  async function agregarEmpleado() {
    if (!nuevoNombre || !nuevaCedula) return alert("Llena todos los campos");
    await supabase.from('empleados').insert([{ nombre: nuevoNombre, cedula_id: nuevaCedula, pin_seguridad: '1234' }]);
    setNuevoNombre(''); setNuevaCedula('');
    fetchData();
  }

  async function eliminarEmpleado(id: string) {
    if (confirm("¿Estás seguro de desactivar este empleado?")) {
      await supabase.from('empleados').update({ activo: false }).eq('id', id);
      fetchData();
    }
  }

  const exportarExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(logs);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Accesos");
    XLSX.writeFile(workbook, "Reporte_Almacen.xlsx");
  };

  return (
    <main className="min-h-screen bg-slate-950 p-4 lg:p-10 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Panel de Control Maestro
          </h1>
          <button onClick={exportarExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-all text-sm">
            <FileSpreadsheet size={18} /> Exportar Excel
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* GESTIÓN DE EMPLEADOS */}
          <section className="lg:col-span-1 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h2 className="flex items-center gap-2 text-xl font-semibold mb-6 text-blue-400">
              <UserPlus size={20} /> Empleados
            </h2>
            <div className="space-y-3 mb-6">
              <input placeholder="Nombre" className="w-full bg-slate-800 p-2 rounded border border-slate-700 outline-none focus:border-blue-500" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
              <input placeholder="Cédula/ID" className="w-full bg-slate-800 p-2 rounded border border-slate-700 outline-none focus:border-blue-500" value={nuevaCedula} onChange={e => setNuevaCedula(e.target.value)} />
              <button onClick={agregarEmpleado} className="w-full bg-blue-600 py-2 rounded font-bold hover:bg-blue-700 transition-colors">Añadir</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {empleados.map(emp => (
                <div key={emp.id} className="flex justify-between items-center p-3 bg-slate-800 rounded group">
                  <div>
                    <p className="text-sm font-bold">{emp.nombre}</p>
                    <p className="text-[10px] text-slate-500">ID: {emp.cedula_id}</p>
                  </div>
                  <button onClick={() => eliminarEmpleado(emp.id)} className="text-slate-600 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* REGISTROS DE ACCESO */}
          <section className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <h2 className="text-xl font-semibold mb-6 text-emerald-400">Historial Reciente</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-3">Empleado</th>
                    <th className="pb-3">Fecha</th>
                    <th className="pb-3">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-3">{log.nombre_empleado}</td>
                      <td className="py-3 text-slate-400">{new Date(log.fecha_hora).toLocaleTimeString()}</td>
                      <td className="py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-red-900/30 text-red-500'}`}>
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