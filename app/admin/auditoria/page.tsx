'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Radar, RadarChart, PolarGrid, PolarAngleAxis
} from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AuditoriaQuirurgicaFinal() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptoSeleccionado, setDeptoSeleccionado] = useState<string | null>(null);
  const [rangoDias, setRangoDias] = useState<number | 'todo'>('todo'); //

  const router = useRouter();

  // Mapeo basado en nivel_acceso (numeric) de la captura de empleados
  const getDepto = (nivel: any) => {
    const n = Number(nivel) || 1;
    if (n <= 2) return { nombre: 'OPERATIVO', color: '#3b82f6' };
    if (n === 3) return { nombre: 'SUPERVISIÓN', color: '#10b981' };
    if (n >= 4 && n <= 7) return { nombre: 'ADMIN', color: '#8b5cf6' };
    return { nombre: 'SOPORTE/IT', color: '#f59e0b' };
  };

  const fetchAuditoria = useCallback(async () => {
    setLoading(true);
    try {
      // Query blindada contra fallos de relación RLS
      const { data, error } = await supabase
        .from('reportes_auditoria')
        .select('*, empleados(nombre, nivel_acceso)')
        .order('fecha_proceso', { ascending: false });

      if (error) throw error;
      
      const dataProcesada = (data || []).map(m => {
        const rel = Array.isArray(m.empleados) ? m.empleados[0] : m.empleados;
        const deptoInfo = getDepto(rel?.nivel_acceso);
        
        // Normalización de fecha para evitar desfases UTC
        const fechaParts = m.fecha_proceso ? m.fecha_proceso.split('-') : null;
        const rawDate = fechaParts 
          ? new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2])) 
          : new Date();

        return {
          ...m,
          nombre_empleado: rel?.nombre || `ID: ${m.empleado_id?.slice(0,8)}`, //
          depto_nombre: deptoInfo.nombre,
          depto_color: deptoInfo.color,
          fecha_corta: fechaParts ? `${fechaParts[2]}/${fechaParts[1]}` : '--/--',
          raw_date: rawDate
        };
      });

      setMetricas(dataProcesada);
    } catch (err) {
      console.error("Error Crítico de Auditoría:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);

  const metricasFiltradas = useMemo(() => {
    let filtradas = [...metricas];
    if (deptoSeleccionado) {
      filtradas = filtradas.filter(m => m.depto_nombre === deptoSeleccionado);
    }
    if (rangoDias !== 'todo') {
      const hoy = new Date();
      hoy.setHours(0,0,0,0);
      const limite = new Date();
      limite.setDate(hoy.getDate() - (rangoDias as number));
      filtradas = filtradas.filter(m => m.raw_date >= limite);
    }
    return filtradas;
  }, [metricas, deptoSeleccionado, rangoDias]);

  const insights = useMemo(() => {
    if (metricasFiltradas.length === 0) return { fugas: 0, avgScore: 0, total: 0 };
    const fugas = metricasFiltradas.reduce((acc, curr) => acc + (Number(curr.horas_exceso) || 0), 0);
    const avgScore = metricasFiltradas.reduce((acc, curr) => acc + (Number(curr.eficiencia_score) || 0), 0) / metricasFiltradas.length;
    return { fugas, avgScore, total: metricasFiltradas.length };
  }, [metricasFiltradas]);

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 gap-6 border-b border-white/5 pb-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()} 
              className="text-slate-500 hover:text-blue-500 font-bold uppercase text-[10px] tracking-[0.2em] italic transition-all group flex items-center gap-2"
            >
              <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> VOLVER ATRÁS
            </button>
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
              AUDITORÍA <span className="text-blue-500">QUIRÚRGICA 2.0</span>
            </h1>
          </div>
          <div className="flex gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10">
            {[{ l: '7D', v: 7 }, { l: '30D', v: 30 }, { l: 'TODO', v: 'todo' }].map(btn => (
              <button key={btn.l} onClick={() => setRangoDias(btn.v as any)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${rangoDias === btn.v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{btn.l}</button>
            ))}
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Efectividad Promedio</p>
            <h2 className="text-4xl font-black text-white">{Math.round(insights.avgScore)}%</h2>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 text-rose-500">Horas de Fuga</p>
            <h2 className="text-4xl font-black text-rose-500">{insights.fugas.toFixed(1)}h</h2>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 text-blue-500">Total Analizado</p>
            <h2 className="text-4xl font-black text-blue-500">{insights.total}</h2>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-[10px] uppercase font-black text-slate-600 tracking-widest">
              <tr>
                <th className="p-6">Empleado / Fecha</th>
                <th className="p-6 text-center">Presencia</th>
                <th className="p-6 text-center text-rose-500">Fuga Extra</th>
                <th className="p-6 text-right">Score Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {metricasFiltradas.map((m) => (
                <tr key={m.id} className="hover:bg-blue-600/5 transition-all group">
                  <td className="p-6">
                    <p className="font-black text-white uppercase group-hover:text-blue-400">{m.nombre_empleado}</p>
                    <p className="text-[9px] text-slate-600 font-mono italic">{m.fecha_proceso}</p>
                  </td>
                  <td className="p-6 text-center text-slate-400 font-mono">{m.horas_totales_presencia}h</td>
                  <td className="p-6 text-center font-black text-rose-500">+{m.horas_exceso}</td>
                  <td className="p-6 text-right font-black font-mono text-blue-500 text-lg">{Math.round(m.eficiencia_score)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}