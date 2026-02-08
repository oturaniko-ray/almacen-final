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
      // Ajuste de query: Usamos el nombre exacto de la tabla y relación
      const { data, error } = await supabase
        .from('reportes_auditoria')
        .select(`
          *,
          empleados:empleado_id ( nombre, nivel_acceso )
        `)
        .order('fecha_proceso', { ascending: false });

      if (error) throw error;
      
      const dataProcesada = data.map(m => ({
        ...m,
        nombre_empleado: m.empleados?.nombre || 'Desconocido',
        depto_nombre: getDepto(Number(m.empleados?.nivel_acceso) || 1).nombre,
        depto_color: getDepto(Number(m.empleados?.nivel_acceso) || 1).color,
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

  const metricasFiltradas = useMemo(() => {
    let filtradas = [...metricas];
    if (deptoSeleccionado) {
      filtradas = filtradas.filter(m => m.depto_nombre === deptoSeleccionado);
    }
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
    if (data.length === 0) return { fugas: 0, avgScore: 0, lista: [] };
    const fugas = data.reduce((acc, curr) => acc + (Number(curr.horas_exceso) || 0), 0);
    const avgScore = data.reduce((acc, curr) => acc + (Number(curr.eficiencia_score) || 0), 0) / data.length;
    const lista = [];
    if (fugas > 5) lista.push({ tipo: 'COSTO', titulo: 'Fuga Crítica', desc: 'Exceso de horas detectado.' });
    return { fugas, avgScore, lista };
  }, [metricasFiltradas]);

  const radarData = useMemo(() => {
    const departamentos = ['OPERATIVO', 'SUPERVISIÓN', 'ADMIN', 'SOPORTE/IT'];
    return departamentos.map(d => {
      const dData = metricasFiltradas.filter(m => m.depto_nombre === d);
      const total = dData.length || 1;
      const score = dData.reduce((acc, c) => acc + Number(c.eficiencia_score), 0) / total;
      return { subject: d, A: score };
    });
  }, [metricasFiltradas]);

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
              AUDITORÍA <span className="text-blue-500">QUIRÚRGICA 2.0</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Diagnóstico Temporal Avanzado</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
            {[{ l: 'Hoy', v: 1 }, { l: '7D', v: 7 }, { l: '30D', v: 30 }, { l: 'Todo', v: 'todo' }].map(btn => (
              <button key={btn.l} onClick={() => setRangoDias(btn.v as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${rangoDias === btn.v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{btn.l}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Promedio Periodo</p>
                <h2 className="text-4xl font-black text-white">{Math.round(insights.avgScore)}%</h2>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                        <PolarGrid stroke="#1e293b" />
                        <PolarAngleAxis dataKey="subject" tick={{fill: '#475569', fontSize: 10}} />
                        <Radar name="Score" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                        <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none'}} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...metricasFiltradas].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="fecha_corta" stroke="#475569" fontSize={9} />
                        <YAxis stroke="#475569" fontSize={9} />
                        <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none'}} />
                        <Line type="monotone" dataKey="eficiencia_score" stroke="#3b82f6" strokeWidth={3} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden">
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
                    {metricasFiltradas.map((m) => (
                        <tr key={m.id} className="hover:bg-blue-600/5 transition-all">
                            <td className="p-6">
                                <p className="text-[12px] font-black text-white uppercase">{m.nombre_empleado}</p>
                                <p className="text-[9px] text-slate-600 font-mono italic">{m.fecha_proceso}</p>
                            </td>
                            <td className="p-6 text-center text-slate-400 font-mono text-[11px]">{m.horas_totales_presencia}h</td>
                            <td className="p-6 text-center">
                                <span className={`text-[11px] font-black ${m.horas_exceso > 0 ? 'text-rose-500' : 'text-slate-500'}`}>+{m.horas_exceso}</span>
                            </td>
                            <td className="p-6 text-right">
                                <span className={`text-lg font-black font-mono ${m.eficiencia_score > 85 ? 'text-blue-500' : 'text-rose-600'}`}>{m.eficiencia_score}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </main>
  );
}