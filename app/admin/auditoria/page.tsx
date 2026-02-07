'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AuditoriaKPI() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptoSeleccionado, setDeptoSeleccionado] = useState<string | null>(null);
  const router = useRouter();

  const getDepto = (nivel: number) => {
    if (nivel <= 2) return { nombre: 'OPERATIVO', color: '#3b82f6' };
    if (nivel === 3) return { nombre: 'SUPERVISIÓN', color: '#10b981' };
    if (nivel >= 4 && nivel <= 7) return { nombre: 'ADMIN', color: '#8b5cf6' };
    return { nombre: 'SOPORTE/IT', color: '#f59e0b' };
  };

  const fetchAuditoria = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reportes_auditoria')
        .select('*, empleados ( nombre, nivel_acceso )')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      
      const dataProcesada = data.map(m => ({
        ...m,
        nombre_empleado: m.empleados?.nombre || 'Desconocido',
        depto_nombre: getDepto(m.empleados?.nivel_acceso || 1).nombre,
        depto_color: getDepto(m.empleados?.nivel_acceso || 1).color,
        fecha_corta: m.fecha_proceso ? m.fecha_proceso.split('-').reverse().slice(0, 2).join('/') : '--/--'
      }));

      setMetricas(dataProcesada);
    } catch (err) {
      console.error("Error en KPI:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);

  // FILTRADO DINÁMICO
  const metricasFiltradas = useMemo(() => {
    if (!deptoSeleccionado) return metricas;
    return metricas.filter(m => m.depto_nombre === deptoSeleccionado);
  }, [metricas, deptoSeleccionado]);

  // CÁLCULOS KPI BASADOS EN EL FILTRO
  const stats = useMemo(() => {
    const data = metricasFiltradas;
    const total = data.length || 1;
    const fugas = data.reduce((acc, curr) => acc + (Number(curr.horas_exceso) || 0), 0);
    const scoreGral = Math.round(data.reduce((acc, curr) => acc + (Number(curr.eficiencia_score) || 0), 0) / total);
    
    // Data para el PieChart (Siempre usa la data total para dar contexto global)
    const porDepto = metricas.reduce((acc: any, curr) => {
      const d = curr.depto_nombre;
      if (!acc[d]) acc[d] = { name: d, value: 0, fill: curr.depto_color };
      acc[d].value += 1;
      return acc;
    }, {});

    return { fugas, scoreGral, deptoData: Object.values(porDepto) };
  }, [metricas, metricasFiltradas]);

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center font-black text-blue-500 animate-pulse uppercase tracking-[0.4em]">
      Analizando Estructura...
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black italic text-white tracking-tighter uppercase">
              KPI <span className="text-blue-500">POR DEPARTAMENTO</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
                <span className={`w-2 h-2 rounded-full ${deptoSeleccionado ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`}></span>
                <p className="text-[10px] font-bold text-slate-500 tracking-[0.3em] uppercase">
                    {deptoSeleccionado ? `Filtrando por: ${deptoSeleccionado}` : 'Visualizando Planta Completa'}
                </p>
            </div>
          </div>
          <div className="flex gap-4">
            {deptoSeleccionado && (
                <button onClick={() => setDeptoSeleccionado(null)} className="text-[10px] font-black text-rose-500 border border-rose-500/20 px-4 py-2 rounded-full hover:bg-rose-500 hover:text-white transition-all">LIMPIAR FILTRO</button>
            )}
            <button onClick={() => router.push('/reportes')} className="bg-white/5 hover:bg-white hover:text-black px-6 py-2 rounded-full text-[10px] font-black transition-all border border-white/10 uppercase">Volver</button>
          </div>
        </div>

        {/* SELECTOR DE DEPARTAMENTO (TABS) */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {stats.deptoData.map((d: any) => (
                <button 
                    key={d.name} 
                    onClick={() => setDeptoSeleccionado(d.name)}
                    className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${deptoSeleccionado === d.name ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'}`}
                >
                    {d.name}
                </button>
            ))}
        </div>

        {/* KPI CARDS DINÁMICOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden group">
             <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Pérdida por Excesos</p>
             <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-black tracking-tighter transition-colors ${stats.fugas > 10 ? 'text-rose-500' : 'text-white'}`}>{stats.fugas.toFixed(1)}</span>
                <span className="text-slate-500 font-bold uppercase text-xs tracking-tighter">Horas Extra</span>
             </div>
          </div>

          <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden">
             <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Salud Operativa</p>
             <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-black tracking-tighter transition-colors ${stats.scoreGral < 70 ? 'text-rose-500' : 'text-white'}`}>{stats.scoreGral}%</span>
                <span className="text-blue-500 font-bold uppercase text-xs tracking-tighter">Eficiencia</span>
             </div>
          </div>

          <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 shadow-2xl">
             <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Impacto en Auditoría</p>
             <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white tracking-tighter">{metricasFiltradas.length}</span>
                <span className="text-emerald-500 font-bold uppercase text-xs tracking-tighter">Registros</span>
             </div>
          </div>
        </div>

        {/* LOG DE AUDITORÍA COLORIZADO */}
        <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 shadow-inner">
          <h3 className="text-[11px] font-black uppercase text-slate-400 mb-6 flex items-center gap-3 tracking-widest">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
            Logs de {deptoSeleccionado || 'Planta Completa'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] text-slate-500 uppercase tracking-widest border-b border-white/5">
                  <th className="pb-4 font-black">Empleado</th>
                  <th className="pb-4 font-black text-center">Área</th>
                  <th className="pb-4 font-black text-center">Presencia</th>
                  <th className="pb-4 font-black text-center">Exceso</th>
                  <th className="pb-4 font-black text-right">Eficiencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {metricasFiltradas.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="py-20 text-center text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">Sin datos para este filtro</td>
                    </tr>
                ) : (
                    metricasFiltradas.map((m) => (
                    <tr key={m.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="py-4">
                            <p className="text-[12px] font-black text-white uppercase group-hover:text-blue-400 transition-all">{m.nombre_empleado}</p>
                            <p className="text-[9px] font-mono text-slate-600 italic">{m.fecha_proceso}</p>
                        </td>
                        <td className="py-4 text-center">
                            <span className="text-[8px] font-black px-3 py-1 rounded-full border border-white/5" style={{color: m.depto_color, borderColor: `${m.depto_color}20`, backgroundColor: `${m.depto_color}05`}}>
                                {m.depto_nombre}
                            </span>
                        </td>
                        <td className="py-4 text-center text-[11px] font-bold text-slate-400 font-mono">{m.horas_totales_presencia}h</td>
                        <td className="py-4 text-center">
                            <span className={`text-[11px] font-black ${Number(m.horas_exceso) > 0 ? 'text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded' : 'text-slate-700'}`}>
                                +{m.horas_exceso}h
                            </span>
                        </td>
                        <td className="py-4 text-right">
                            <span className={`text-[13px] font-black font-mono px-3 py-1 rounded-lg ${m.eficiencia_score > 80 ? 'text-blue-500 bg-blue-500/5' : 'text-rose-500 bg-rose-500/5'}`}>
                                {m.eficiencia_score}
                            </span>
                        </td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}