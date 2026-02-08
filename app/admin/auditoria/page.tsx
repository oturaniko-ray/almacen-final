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
  const [rangoDias, setRangoDias] = useState<number | 'todo'>('todo');

  const router = useRouter();

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
      // Forzamos la obtención de datos ignorando errores de relación si el RLS es parcial
      const { data, error } = await supabase
        .from('reportes_auditoria')
        .select(`
          *,
          empleados (
            nombre,
            nivel_acceso
          )
        `)
        .order('fecha_proceso', { ascending: false });

      if (error) {
        console.error("Error en Fetch Supabase:", error.message);
        throw error;
      }
      
      if (!data || data.length === 0) {
        setMetricas([]);
        return;
      }

      const dataProcesada = data.map(m => {
        const rel = Array.isArray(m.empleados) ? m.empleados[0] : m.empleados;
        const deptoInfo = getDepto(rel?.nivel_acceso);
        
        const fechaParts = m.fecha_proceso ? m.fecha_proceso.split('-') : null;
        const rawDate = fechaParts 
          ? new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2])) 
          : new Date();

        return {
          ...m,
          nombre_empleado: rel?.nombre || `ID: ${m.empleado_id?.slice(0,8)}`,
          depto_nombre: deptoInfo.nombre,
          depto_color: deptoInfo.color,
          fecha_corta: fechaParts ? `${fechaParts[2]}/${fechaParts[1]}` : '--/--',
          raw_date: rawDate
        };
      });

      setMetricas(dataProcesada);
    } catch (err) {
      console.error("Falla Crítica de Auditoría:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchAuditoria(); 
  }, [fetchAuditoria]);

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

  const radarData = useMemo(() => {
    const departamentos = ['OPERATIVO', 'SUPERVISIÓN', 'ADMIN', 'SOPORTE/IT'];
    return departamentos.map(d => {
      const dData = metricasFiltradas.filter(m => m.depto_nombre === d);
      const score = dData.length === 0 ? 0 : dData.reduce((acc, c) => acc + Number(c.eficiencia_score), 0) / dData.length;
      return { subject: d, A: Math.round(score) };
    });
  }, [metricasFiltradas]);

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 border-b border-white/5 pb-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()} 
              className="text-slate-500 hover:text-blue-500 font-bold uppercase text-[10px] tracking-[0.2em] italic transition-all flex items-center gap-2 group"
            >
              <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> VOLVER ATRÁS
            </button>
            <div>
              <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter leading-none">
                AUDITORÍA <span className="text-blue-500">QUIRÚRGICA</span>
              </h1>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-1">Sincronización: {insights.total} registros</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10">
            {[{ l: '7D', v: 7 }, { l: '30D', v: 30 }, { l: 'TODO', v: 'todo' }].map(btn => (
              <button key={btn.l} onClick={() => setRangoDias(btn.v as any)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${rangoDias === btn.v ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}>{btn.l}</button>
            ))}
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 italic tracking-widest">Efectividad Promedio</p>
            <h2 className="text-4xl font-black text-white">{Math.round(insights.avgScore)}%</h2>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 italic tracking-widest">Horas de Fuga</p>
            <h2 className="text-4xl font-black text-rose-500">{insights.fugas.toFixed(1)}h</h2>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl text-blue-500">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 italic tracking-widest">Total Analizado</p>
            <h2 className="text-4xl font-black">{insights.total}</h2>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl mb-20">
          <table className="w-full text-left">
            <thead className="text-[9px] font-black uppercase text-slate-600 tracking-widest bg-black/20 italic">
              <tr>
                <th className="p-6">Identidad / Periodo</th>
                <th className="p-6 text-center">Horas Presencia</th>
                <th className="p-6 text-center">Fuga Extra</th>
                <th className="p-6 text-right">Score Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="p-20 text-center font-black italic text-blue-500 animate-pulse uppercase tracking-[0.3em]">Consultando protocolos...</td></tr>
              ) : metricasFiltradas.length === 0 ? (
                <tr><td colSpan={4} className="p-20 text-center font-bold italic text-slate-700 uppercase tracking-widest">No se detectan datos (Verificar RLS)</td></tr>
              ) : (
                metricasFiltradas.map((m) => (
                  <tr key={m.id} className="hover:bg-blue-600/5 transition-all group">
                    <td className="p-6">
                      <p className="text-[12px] font-black text-white uppercase group-hover:text-blue-400 transition-colors leading-tight">{m.nombre_empleado}</p>
                      <p className="text-[9px] text-slate-600 font-mono italic mt-0.5">{m.fecha_proceso}</p>
                    </td>
                    <td className="p-6 text-center text-slate-400 font-mono text-[11px]">{m.horas_totales_presencia || 0}h</td>
                    <td className="p-6 text-center font-black text-rose-500">+{m.horas_exceso}</td>
                    <td className="p-6 text-right font-black font-mono text-blue-500 text-lg">{Math.round(m.eficiencia_score)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}