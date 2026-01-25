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
  }, []);

  const fetchData = async () => {
    const { data: emp } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    const { data: mov } = await supabase.from('movimientos_acceso').select('*').order('fecha_hora', { ascending: false });
    if (emp) setEmpleados(emp);
    if (mov) setMovimientos(mov);
  };

  const calcularAusencia = (empId: string) => {
    const ultimaSalida = movimientos.find(m => m.empleado_id === empId && m.tipo_movimiento === 'salida');
    if (!ultimaSalida) return '0.0H';
    const horas = (new Date().getTime() - new Date(ultimaSalida.fecha_hora).getTime()) / (1000 * 60 * 60);
    return `${horas.toFixed(1)}H`;
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);
  const total = empleados.length;

  const exportar = () => {
    const ahora = new Date();
    const ts = ahora.toISOString().replace(/[-T:Z.]/g, '').slice(0, 12);
    const encabezado = [
      ["REPORTE DE PRESENCIA"],
      ["AUTOR:", user?.nombre.toUpperCase(), "ROL:", user?.rol.toUpperCase()],
      ["FECHA:", ahora.toLocaleString()],
      ["TOTAL:", total, "PRESENTES:", presentes.length, "AUSENTES:", ausentes.length],
      [],
      ["NOMBRE", "ESTADO", "TIEMPO FUERA"]
    ];
    const cuerpo = empleados.map(e => [e.nombre, e.en_almacen ? 'PRESENTE' : 'AUSENTE', e.en_almacen ? '---' : calcularAusencia(e.id)]);
    const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...cuerpo]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PRESENCIA");
    XLSX.writeFile(wb, `Presencia${ts}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-black uppercase tracking-tighter">ESTADO DE <span className="text-blue-500">PRESENCIA</span></h1>
        <div className="flex gap-4">
          <button onClick={exportar} className="bg-emerald-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg">EXPORTAR</button>
          <button onClick={() => router.push('/admin')} className="bg-slate-800 px-6 py-2 rounded-xl font-black text-[10px] uppercase">VOLVER</button>
        </div>
      </header>

      <section className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 mb-10 flex flex-col md:flex-row items-center justify-around shadow-2xl">
         <div className="text-center">
            <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-[0.3em] mb-4">PRESENCIA EN <span className="text-white">ALMACÉN</span></h3>
            <div className="w-40 h-40 rounded-full border-8 border-[#050a14] flex flex-col items-center justify-center bg-[#0f172a] shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 opacity-20" style={{ background: `conic-gradient(#3b82f6 ${(presentes.length/total)*100}%, transparent 0)` }}></div>
               <span className="text-3xl font-black">{presentes.length}</span>
               <span className="text-[8px] font-black text-slate-500 uppercase">EN SITIO</span>
            </div>
         </div>
         <div className="grid grid-cols-3 gap-10 text-center mt-8 md:mt-0">
            <div><p className="text-[9px] font-black uppercase text-slate-500 mb-1 tracking-widest">TOTAL</p><p className="text-4xl font-black">{total}</p></div>
            <div><p className="text-[9px] font-black uppercase text-emerald-500 mb-1 tracking-widest">PRESENTES</p><p className="text-4xl font-black text-emerald-500">{presentes.length}</p></div>
            <div><p className="text-[9px] font-black uppercase text-red-500 mb-1 tracking-widest">AUSENTES</p><p className="text-4xl font-black text-red-500">{ausentes.length}</p></div>
         </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase text-emerald-500 tracking-widest ml-4">✓ PERSONAL EN SITIO</h3>
          {presentes.map(emp => (
            <div key={emp.id} className="bg-emerald-500/5 p-6 rounded-[30px] border border-emerald-500/10 flex justify-between items-center transition-all hover:bg-emerald-500/10">
              <div><h4 className="font-black uppercase text-sm">{emp.nombre}</h4><p className="text-[9px] font-black text-slate-500 uppercase">{emp.rol}</p></div>
              <span className="bg-emerald-500 text-[#050a14] px-4 py-1 rounded-full font-black text-[10px]">EN ALMACÉN</span>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase text-red-500 tracking-widest ml-4">✗ PERSONAL AUSENTE</h3>
          {ausentes.map(emp => (
            <div key={emp.id} className="bg-red-500/5 p-6 rounded-[30px] border border-red-500/10 flex justify-between items-center opacity-70">
              <div><h4 className="font-black uppercase text-sm">{emp.nombre}</h4><p className="text-[9px] font-black text-slate-500 uppercase">{emp.rol}</p></div>
              <div className="text-right">
                <p className="text-[8px] font-black text-red-500 uppercase mb-1">TIEMPO FUERA</p>
                <span className="bg-red-500/20 text-red-500 px-4 py-1 rounded-full font-black text-xs">{calcularAusencia(emp.id)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}