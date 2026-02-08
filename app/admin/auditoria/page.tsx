'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Radar, RadarChart, PolarGrid, PolarAngleAxis
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AuditoriaQuirurgicaFinal() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptoSeleccionado, setDeptoSeleccionado] = useState<string | null>(null);
  
  // ESTADOS DE FILTRO TEMPORAL
  const [rangoDias, setRangoDias] = useState<number | 'todo'>(7);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

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
        .order('fecha_proceso', { ascending: false });

      if (error) throw error;
      
      const dataProcesada = data.map(m => ({
        ...m,
        nombre_empleado: m.empleados?.nombre || 'Desconocido',
        depto_nombre: getDepto(m.empleados?.nivel_acceso || 1).nombre,
        depto_color: getDepto(m.empleados?.nivel_acceso || 1).color,
        fecha_corta: m.fecha_proceso ? m.fecha_proceso.split('-').reverse().slice(0, 2).join('/') : '--/--',
        raw_date: new Date(m.fecha_proceso)
      }));

      setMetricas(dataProcesada);
    } catch (err) {
      console.error("Error en Auditoría:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);

  // LÓGICA DE FILTRADO MULTI-VARIABLE (DEPARTAMENTO + FECHA)
  const metricasFiltradas = useMemo(() => {
    let filtradas = [...metricas];

    // Filtro de Departamento
    if (deptoSeleccionado) {
      filtradas = filtradas.filter(m => m.depto_nombre === deptoSeleccionado);
    }

    // Filtro por Rango Predefinido o Custom
    const hoy = new Date();
    if (rangoDias !== 'todo') {
      const limite = new Date();
      limite.setDate(hoy.getDate() - (rangoDias as number));
      filtradas = filtradas.filter(m => m.raw_date >= limite);
    } else if (fechaInicio && fechaFin) {
      filtradas = filtradas.filter(m => {
        const d = m.raw_date;
        return d >= new Date(fechaInicio) && d <= new Date(fechaFin);
      });
    }

    return filtradas;
  }, [metricas, deptoSeleccionado, rangoDias, fechaInicio, fechaFin]);

  const insights = useMemo(() => {
    const data = metricasFiltradas;
    const lista: any[] = [];
    if (data.length === 0) return { fugas: 0, avgScore: 0, lista: [] };

    const total = data.length;
    const fugas = data.reduce((acc, curr) => acc + (Number(curr.horas_exceso) || 0), 0);
    const avgScore = data.reduce((acc, curr) => acc + (Number(curr.eficiencia_score) || 0), 0) / total;
    
    if (fugas > 10) lista.push({ tipo: 'COSTO', titulo: 'Alerta de Presupuesto', desc: `Fuga de ${fugas.toFixed(1)}h en el periodo.` });
    if (avgScore < 80) lista.push({ tipo: 'PERFORMANCE', titulo: 'Rendimiento Crítico', desc: 'El score bajó del umbral operativo.' });

    return { fugas, avgScore, lista };
  }, [metricasFiltradas]);

  const radarData = useMemo(() => {
    const departamentos = ['OPERATIVO', 'SUPERVISIÓN', 'ADMIN', 'SOPORTE/IT'];
    return departamentos.map(d => {
      const dData = metricasFiltradas.filter(m => m.depto_nombre === d);
      const total = dData.length || 1;
      const score = dData.reduce((acc, c) => acc + c.eficiencia_score, 0) / total;
      const fugas = dData.reduce((acc, c) => acc + c.horas_exceso, 0);
      return { subject: d, A: score, B: Math.min(100, fugas * 5) };
    });
  }, [metricasFiltradas]);

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
              AUDITORÍA <span className="text-blue-500">QUIRÚRGICA 2.0</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Diagnóstico Temporal Avanzado</p>
          </div>
          
          {/* SELECTOR TEMPORAL INTEGRADO */}
          <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
            {[
              { l: 'Hoy', v: 1 }, { l: '7D', v: 7 }, { l: '30D', v: 30 }, { l: 'Todo', v: 'todo' }
            ].map(btn => (
              <button 
                key={btn.l} 
                onClick={() => setRangoDias(btn.v as any)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${rangoDias === btn.v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                {btn.l}
              </button>
            ))}
            <div className="h-4 w-px bg-white/10 mx-2 hidden md:block"></div>
            <input 
              type="date" 
              className="bg-black/40 border-none text-[10px] text-slate-300 rounded px-2 outline-none" 
              onChange={(e) => { setFechaInicio(e.target.value); setRangoDias('todo'); }}
            />
            <span className="text-[10px] text-slate-700">al</span>
            <input 
              type="date" 
              className="bg-black/40 border-none text-[10px] text-slate-300 rounded px-2 outline-none" 
              onChange={(e) => { setFechaFin(e.target.value); setRangoDias('todo'); }}
            />
          </div>
        </div>

        {/* KPIs DINÁMICOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Promedio Periodo</p>
                <h2 className={`text-4xl font-black ${insights.avgScore < 80 ? 'text-rose-500' : 'text-white'}`}>{Math.round(insights.avgScore)}%</h2>
            </div>
            <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Fuga Detectada</p>
                <h2 className="text-4xl font-black text-white">{insights.fugas.toFixed(1)}h</h2>
            </div>
            <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Analítica Insight</p>
                <h2 className="text-4xl font-black text-blue-500">{insights.lista.length}</h2>
            </div>
        </div>

        {/* ZONA DE GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em]">Matriz Departamental ({rangoDias === 'todo' ? 'Personalizado' : `${rangoDias} Días`})</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="#1e293b" />
                            <PolarAngleAxis dataKey="subject" tick={{fill: '#475569', fontSize: 10}} />
                            <Radar name="Score" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none'}} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em]">Deriva de Eficiencia</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...metricasFiltradas].reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="fecha_corta" stroke="#475569" fontSize={9} hide={metricasFiltradas.length > 20} />
                            <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none'}} />
                            <Line type="stepAfter" dataKey="eficiencia_score" stroke="#3b82f6" strokeWidth={3} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* LOG QUIRÚRGICO */}
        <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-[11px] font-black uppercase text-white tracking-widest">Registros Auditados</h3>
                <div className="flex gap-2">
                    {['OPERATIVO', 'SUPERVISIÓN', 'ADMIN'].map(d => (
                        <button 
                            key={d} 
                            onClick={() => setDeptoSeleccionado(deptoSeleccionado === d ? null : d)}
                            className={`px-3 py-1 rounded-md text-[8px] font-bold border transition-all ${deptoSeleccionado === d ? 'bg-white text-black border-white' : 'border-white/10 text-slate-500 hover:border-white/30'}`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="text-[9px] font-black uppercase text-slate-600 tracking-widest bg-black/20">
                        <tr>
                            <th className="p-6">Identificador</th>
                            <th className="p-6 text-center">Presencia</th>
                            <th className="p-6 text-center">Fuga (h)</th>
                            <th className="p-6 text-right">Score Audit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {metricasFiltradas.length === 0 ? (
                            <tr><td colSpan={4} className="p-20 text-center text-[10px] font-black text-slate-800 uppercase tracking-[0.5em]">Sin registros en este periodo</td></tr>
                        ) : (
                            metricasFiltradas.map((m) => (
                                <tr key={m.id} className="group hover:bg-blue-600/5 transition-all">
                                    <td className="p-6">
                                        <p className="text-[12px] font-black text-white uppercase">{m.nombre_empleado}</p>
                                        <p className="text-[9px] text-slate-600 font-mono italic">{m.fecha_proceso}</p>
                                    </td>
                                    <td className="p-6 text-center text-slate-400 font-mono text-[11px]">{m.horas_totales_presencia}h</td>
                                    <td className="p-6 text-center">
                                        <span className={`text-[11px] font-black ${m.horas_exceso > 0 ? 'text-rose-500' : 'text-slate-800'}`}>+{m.horas_exceso}</span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className={`text-lg font-black font-mono ${m.eficiencia_score > 85 ? 'text-blue-500' : 'text-rose-600'}`}>{m.eficiencia_score}</span>
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