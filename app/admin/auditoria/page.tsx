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
  
  // Cambiado a 'todo' para asegurar visibilidad inicial de los datos existentes
  const [rangoDias, setRangoDias] = useState<number | 'todo'>('todo');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const router = useRouter();

  const getDepto = (nivel: any) => {
    const n = Number(nivel);
    if (n <= 2) return { nombre: 'OPERATIVO', color: '#3b82f6' };
    if (n === 3) return { nombre: 'SUPERVISIÓN', color: '#10b981' };
    if (n >= 4 && n <= 7) return { nombre: 'ADMIN', color: '#8b5cf6' };
    return { nombre: 'SOPORTE/IT', color: '#f59e0b' };
  };

  const fetchAuditoria = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reportes_auditoria')
        .select(`
          *,
          empleados ( nombre, nivel_acceso )
        `)
        .order('fecha_proceso', { ascending: false });

      if (error) throw error;
      
      const dataProcesada = (data || []).map(m => {
        // Manejo robusto de la relación con empleados
        const empData = Array.isArray(m.empleados) ? m.empleados[0] : m.empleados;
        const deptoInfo = getDepto(empData?.nivel_acceso || 1);
        
        // Normalización de fecha para evitar desfases de zona horaria
        const [y, mes, d] = m.fecha_proceso.split('-');
        const fechaNormalizada = new Date(parseInt(y), parseInt(mes) - 1, parseInt(d));

        return {
          ...m,
          nombre_empleado: empData?.nombre || 'SISTEMA',
          depto_nombre: deptoInfo.nombre,
          depto_color: deptoInfo.color,
          fecha_corta: `${d}/${mes}`,
          raw_date: fechaNormalizada
        };
      });

      setMetricas(dataProcesada);
    } catch (err) {
      console.error("Falla en Auditoría:", err);
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
      hoy.setHours(0, 0, 0, 0);
      const limite = new Date();
      limite.setDate(hoy.getDate() - (rangoDias as number));
      limite.setHours(0, 0, 0, 0);
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
      return { subject: d, A: score };
    });
  }, [metricasFiltradas]);

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all font-black text-blue-500 text-sm"
            >
              ← VOLVER
            </button>
            <div>
              <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
                AUDITORÍA <span className="text-blue-500">QUIRÚRGICA 2.0</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Datos activos: {insights.total} registros</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
            {[{ l: 'Hoy', v: 1 }, { l: '7D', v: 7 }, { l: '30D', v: 30 }, { l: 'Todo', v: 'todo' }].map(btn => (
              <button key={btn.l} onClick={() => setRangoDias(btn.v as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${rangoDias === btn.v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{btn.l}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Promedio Periodo</p>
            <h2 className="text-4xl font-black text-white">{Math.round(insights.avgScore)}%</h2>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Fuga Detectada</p>
            <h2 className="text-4xl font-black text-white">{insights.fugas.toFixed(1)}h</h2>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 text-blue-500">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Muestreo Total</p>
            <h2 className="text-4xl font-black">{insights.total}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{fill: '#475569', fontSize: 10}} />
                <Radar name="Score" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...metricasFiltradas].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="fecha_corta" stroke="#475569" fontSize={9} />
                <YAxis stroke="#475569" fontSize={9} />
                <Line type="monotone" dataKey="eficiencia_score" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="text-[9px] font-black uppercase text-slate-600 tracking-widest bg-black/20">
              <tr>
                <th className="p-6">Empleado / Fecha</th>
                <th className="p-6 text-center">Presencia</th>
                <th className="p-6 text-center">Fuga</th>
                <th className="p-6 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {metricasFiltradas.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center font-bold italic text-slate-600 uppercase">Sin datos en el rango seleccionado</td></tr>
              ) : (
                metricasFiltradas.map((m) => (
                  <tr key={m.id} className="hover:bg-blue-600/5 transition-all">
                    <td className="p-6">
                      <p className="text-[12px] font-black text-white uppercase">{m.nombre_empleado}</p>
                      <p className="text-[9px] text-slate-600 font-mono">{m.fecha_proceso}</p>
                    </td>
                    <td className="p-6 text-center text-slate-400 font-mono">{m.horas_totales_presencia}h</td>
                    <td className="p-6 text-center font-black text-rose-500">+{m.horas_exceso}</td>
                    <td className="p-6 text-right font-black font-mono text-blue-500">{Math.round(m.eficiencia_score)}%</td>
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