'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [reportes, setReportes] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchReportes();
  }, []);

  const fetchReportes = async () => {
    const { data } = await supabase.from('jornadas').select('*').order('fecha', { ascending: false });
    if (data) setReportes(data);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <header className="mb-12 flex justify-between items-center max-w-6xl mx-auto">
        <h1 className="text-3xl font-black uppercase tracking-tighter">REPORTES <span className="text-blue-500">OPERACIÓN</span></h1>
        <button onClick={() => router.push('/')} className="bg-slate-800 px-6 py-2 rounded-xl font-black text-[10px] uppercase">VOLVER</button>
      </header>

      <div className="max-w-6xl mx-auto overflow-hidden rounded-[35px] border border-white/5 bg-[#0f172a] shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-white/5">
            <tr>
              <th className="p-6 font-black uppercase text-[10px] text-slate-500">EMPLEADO</th>
              <th className="p-6 font-black uppercase text-[10px] text-slate-500">ENTRADA</th>
              <th className="p-6 font-black uppercase text-[10px] text-slate-500">SALIDA</th>
              <th className="p-6 font-black uppercase text-[10px] text-slate-500 text-center">HORAS</th>
            </tr>
          </thead>
          <tbody>
            {reportes.map((r, i) => (
              <tr key={i} className="border-t border-white/5 hover:bg-white/[0.01]">
                <td className="p-6 font-black uppercase text-sm">{r.nombre_empleado}</td>
                <td className="p-6 text-xs font-black text-slate-400">{new Date(r.hora_entrada).toLocaleString()}</td>
                <td className="p-6 text-xs font-black text-slate-400">{r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'ACTIVO'}</td>
                <td className="p-6 text-center">
                  <span className="bg-blue-600/10 text-blue-500 px-4 py-1 rounded-full font-black text-xs uppercase">{r.horas_trabajadas?.toFixed(1) || '0.0'}H</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}