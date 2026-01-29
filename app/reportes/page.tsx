'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchJornadas();
  }, []);

  const fetchJornadas = async () => {
    setLoading(true);
    // Cambiamos la fuente a 'jornadas' para que coincida con SupervisorPage
    const { data, error } = await supabase
      .from('jornadas')
      .select('*')
      .order('hora_entrada', { ascending: false });
    
    if (!error && data) setJornadas(data);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Reporte de <span className="text-blue-500">Asistencia Real</span></h1>
          <div className="flex gap-4">
            <button onClick={fetchJornadas} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5">Actualizar</button>
            <button onClick={() => router.back()} className="bg-red-600/20 text-red-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-red-500/20">Cerrar</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500 font-black animate-pulse uppercase">Consultando base de datos...</div>
        ) : (
          <div className="overflow-hidden rounded-[35px] border border-white/5 bg-[#0f172a] shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20">
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Empleado</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Entrada</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Salida</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Horas</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Estado</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Autorización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jornadas.map((j) => (
                  <tr key={j.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-6 text-sm font-black text-white uppercase italic">{j.nombre_empleado}</td>
                    <td className="p-6 text-[11px] font-mono text-emerald-500">
                      {new Date(j.hora_entrada).toLocaleString()}
                    </td>
                    <td className="p-6 text-[11px] font-mono text-red-400">
                      {j.hora_salida ? new Date(j.hora_salida).toLocaleString() : '---'}
                    </td>
                    <td className="p-6 text-sm font-black text-blue-400">
                      {j.horas_trabajadas ? j.horas_trabajadas.toFixed(2) + 'h' : 'En curso'}
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${j.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'}`}>
                        {j.estado}
                      </span>
                    </td>
                    <td className="p-6 text-[9px] text-slate-400 italic">{j.editado_por || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}