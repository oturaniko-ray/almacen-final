'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    
    fetchData();
    const channel = supabase.channel('presencia-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const { data: emp } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    const { data: mov } = await supabase.from('movimientos_acceso').select('*').order('fecha_hora', { ascending: false });
    if (emp) setEmpleados(emp);
    if (mov) setMovimientos(mov);
  };

  const calcularTiempo = (empId: string, tipo: 'entrada' | 'salida') => {
    const ultimo = movimientos.find(m => m.empleado_id === empId && m.tipo_movimiento === tipo);
    if (!ultimo) return '---';
    const diff = (new Date().getTime() - new Date(ultimo.fecha_hora).getTime()) / (1000 * 60 * 60);
    return `${diff.toFixed(1)}h`;
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);
  const totalEmp = empleados.length;
  const porcP = totalEmp > 0 ? (presentes.length / totalEmp) * 100 : 0;

  const exportarPresencia = () => {
    const ahora = new Date();
    // Formato fecha y hora sin guiones: AAAAMMDDHHMM
    const timestamp = ahora.toISOString().replace(/[-T:Z.]/g, '').slice(0, 12);
    
    const encabezado = [
      ["REPORTE DE PRESENCIA"],
      ["Generado por:", user?.nombre, "Rol:", user?.rol],
      ["Fecha/Hora:", ahora.toLocaleString()],
      ["Total Empleados:", totalEmp],
      [],
      ["PRESENTES", "", "AUSENTES", ""],
      ["Nombre", "Tiempo (In)", "Nombre", "Tiempo (Out)"]
    ];

    const maxRows = Math.max(presentes.length, ausentes.length);
    const cuerpo = [];
    for (let i = 0; i < maxRows; i++) {
      cuerpo.push([
        presentes[i]?.nombre || "",
        presentes[i] ? calcularTiempo(presentes[i].id, 'entrada') : "",
        ausentes[i]?.nombre || "",
        ausentes[i] ? calcularTiempo(ausentes[i].id, 'salida') : ""
      ]);
    }

    const totales = [
      [],
      ["TOTAL PRESENTES:", presentes.length, "TOTAL AUSENTES:", ausentes.length]
    ];

    const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...cuerpo, ...totales]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presencia");

    XLSX.writeFile(wb, `Presencia${timestamp}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Estado de Presencia</h2>
          <div className="flex gap-4">
            <button onClick={exportarPresencia} className="bg-emerald-600 px-5 py-2 rounded-xl font-black text-[10px] uppercase">Exportar Presencia</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 px-5 py-2 rounded-xl font-black text-[10px] uppercase">← Volver</button>
          </div>
        </header>

        <section className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 mb-10 flex flex-col md:flex-row items-center justify-around shadow-2xl relative overflow-hidden">
          <div className="text-center">
            <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em] mb-4">Presencia en Almacén</h3>
            <div className="relative w-40 h-40 rounded-full border-8 border-[#050a14] shadow-2xl" 
                 style={{ background: `conic-gradient(#10b981 ${porcP}%, #ef4444 0)` }}>
              <div className="absolute inset-2 bg-[#0f172a] rounded-full flex flex-col items-center justify-center">
                <span className="text-2xl font-black">{Math.round(porcP)}%</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase">Ocupación</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8 text-center mt-8 md:mt-0">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Total Empleados</p>
              <p className="text-4xl font-black text-white">{totalEmp}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest mb-1">Presentes</p>
              <p className="text-4xl font-black text-emerald-500">{presentes.length}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-red-500 tracking-widest mb-1">Ausentes</p>
              <p className="text-4xl font-black text-red-500">{ausentes.length}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* COLUMNA PRESENTES */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-emerald-500 ml-4 tracking-widest flex justify-between">
              <span>✓ Presentes</span>
              <span className="text-slate-500">Tiempo In</span>
            </h3>
            {presentes.map(emp => (
              <div key={emp.id} className="bg-emerald-500/5 p-5 rounded-[25px] border border-emerald-500/10 flex justify-between items-center group">
                <div>
                  <h4 className="font-bold text-sm uppercase">{emp.nombre}</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-black">{emp.rol}</p>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-lg text-xs font-black">
                    {calcularTiempo(emp.id, 'entrada')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* COLUMNA AUSENTES */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-red-500 ml-4 tracking-widest flex justify-between">
              <span>✗ Ausentes</span>
              <span className="text-slate-500">Tiempo Out</span>
            </h3>
            {ausentes.map(emp => (
              <div key={emp.id} className="bg-red-500/5 p-5 rounded-[25px] border border-red-500/10 flex justify-between items-center opacity-70 group">
                <div>
                  <h4 className="font-bold text-sm uppercase">{emp.nombre}</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-black">{emp.rol}</p>
                </div>
                <div className="text-right">
                  <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-lg text-xs font-black">
                    {calcularTiempo(emp.id, 'salida')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}