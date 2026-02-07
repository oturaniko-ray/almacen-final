'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AuditoriaInteligente() {
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
      console.error("Error en Auditoría:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);

  const metricasFiltradas = useMemo(() => {
    return deptoSeleccionado ? metricas.filter(m => m.depto_nombre === deptoSeleccionado) : metricas;
  }, [metricas, deptoSeleccionado]);

  // MOTOR DE RECOMENDACIONES LÓGICAS
  const insights = useMemo(() => {
    const data = metricasFiltradas;
    if (data.length === 0) return [];

    const total = data.length;
    const fugas = data.reduce((acc, curr) => acc + (Number(curr.horas_exceso) || 0), 0);
    const avgScore = data.reduce((acc, curr) => acc + (Number(curr.eficiencia_score) || 0), 0) / total;
    const incidencias = data.filter(d => d.incidencia_tipo !== 'normal').length;
    const ratioIncidencia = (incidencias / total) * 100;

    const lista: any[] = [];

    // Lógica 1: Fuga Crítica
    if (fugas > 15) {
      lista.push({
        tipo: 'CRÍTICO',
        titulo: 'Fuga de Capital Detectada',
        desc: `Se han acumulado ${fugas.toFixed(1)}h de exceso. Se recomienda revisar la carga de trabajo o contratar personal de refuerzo.`,
        color: 'text-rose-500',
        bg: 'bg-rose-500/10'
      });
    }

    // Lógica 2: Eficiencia Baja
    if (avgScore < 75) {
      lista.push({
        tipo: 'ADVERTENCIA',
        titulo: 'Baja Eficiencia Operativa',
        desc: `El score promedio es de ${Math.round(avgScore)}%. Existe un patrón de incumplimiento en los horarios establecidos.`,
        color: 'text-amber-500',
        bg: 'bg-amber-500/10'
      });
    }

    // Lógica 3: Estabilidad
    if (ratioIncidencia < 10 && avgScore > 90) {
      lista.push({
        tipo: 'OPTIMO',
        titulo: 'Operación Saludable',
        desc: 'El departamento mantiene una relación de presencia/tiempo excelente. Mantener incentivos actuales.',
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10'
      });
    }

    return { fugas, avgScore, incidencias, lista, deptoData: [] }; // simplificado para el return
  }, [metricasFiltradas]);

  const deptoData = useMemo(() => {
    const porDepto = metricas.reduce((acc: any, curr) => {
      const d = curr.depto_nombre;
      if (!acc[d]) acc[d] = { name: d, value: 0, fill: curr.depto_color };
      acc[d].value += 1;
      return acc;
    }, {});
    return Object.values(porDepto);
  }, [metricas]);

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black animate-pulse">CARGANDO INTELIGENCIA...</div>;

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
              AUDITORÍA <span className="text-blue-500">INTELIGENTE</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Análisis Prescriptivo de Personal</p>
          </div>
          <button onClick={() => router.push('/reportes')} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase">REGRESAR</button>
        </div>

        {/* RECOMENDACIONES IA (Insights Section) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {insights.lista.map((ins: any, i: number) => (
                <div key={i} className={`${ins.bg} p-6 rounded-[24px] border border-white/5 flex flex-col gap-2`}>
                    <div className="flex justify-between items-center">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded ${ins.color} border border-current opacity-70`}>{ins.tipo}</span>
                        <span className="animate-ping w-1.5 h-1.5 rounded-full bg-current"></span>
                    </div>
                    <h4 className={`text-[12px] font-black uppercase ${ins.color}`}>{ins.titulo}</h4>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{ins.desc}</p>
                </div>
            ))}
            {insights.lista.length === 0 && (
                <div className="bg-blue-500/5 p-6 rounded-[24px] border border-white/5 flex items-center justify-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Sin anomalías críticas detectadas</p>
                </div>
            )}
        </div>

        {/* SELECTOR Y KPIs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            <button onClick={() => setDeptoSeleccionado(null)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${!deptoSeleccionado ? 'bg-white text-black' : 'bg-white/5 text-slate-500'}`}>TODOS</button>
            {deptoData.map((d: any) => (
                <button key={d.name} onClick={() => setDeptoSeleccionado(d.name)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${deptoSeleccionado === d.name ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-500'}`}>{d.name}</button>
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Score Promedio</p>
                <h2 className="text-5xl font-black text-white">{Math.round(insights.avgScore || 0)}%</h2>
            </div>
            <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Total Fugas</p>
                <h2 className={`text-5xl font-black ${insights.fugas > 10 ? 'text-rose-500' : 'text-white'}`}>{insights.fugas.toFixed(1)}h</h2>
            </div>
            <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Incidencias</p>
                <h2 className="text-5xl font-black text-white">{insights.incidencias}</h2>
            </div>
        </div>

        {/* TABLA DE AUDITORÍA */}
        <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-white/5 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                    <tr>
                        <th className="p-6">Empleado</th>
                        <th className="p-6 text-center">Depto</th>
                        <th className="p-6 text-center">Presencia</th>
                        <th className="p-6 text-right">Eficiencia</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {metricasFiltradas.map((m) => (
                        <tr key={m.id} className="hover:bg-white/[0.02] transition-all">
                            <td className="p-6 font-black text-[12px] uppercase">{m.nombre_empleado} <br/><span className="text-[9px] text-slate-600 font-mono font-normal">{m.fecha_proceso}</span></td>
                            <td className="p-6 text-center">
                                <span className="text-[8px] font-black px-2 py-1 rounded border border-white/10" style={{color: m.depto_color}}>{m.depto_nombre}</span>
                            </td>
                            <td className="p-6 text-center text-slate-400 font-mono text-[11px] font-bold">{m.horas_totales_presencia}h <span className="text-rose-500 ml-1">(+{m.horas_exceso})</span></td>
                            <td className={`p-6 text-right font-black text-lg font-mono ${m.eficiencia_score > 80 ? 'text-blue-500' : 'text-rose-500'}`}>{m.eficiencia_score}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </main>
  );
}