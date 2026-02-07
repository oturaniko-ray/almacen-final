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
  const router = useRouter();

  // Mapeo lógico de departamentos según nivel_acceso
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
        depto: getDepto(m.empleados?.nivel_acceso || 1),
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

  // CÁLCULOS AVANZADOS (MEMOIZADOS PARA RENDIMIENTO)
  const stats = useMemo(() => {
    const total = metricas.length || 1;
    const fugas = metricas.reduce((acc, curr) => acc + (Number(curr.horas_exceso) || 0), 0);
    const scoreGral = Math.round(metricas.reduce((acc, curr) => acc + (Number(curr.eficiencia_score) || 0), 0) / total);
    
    // Agrupación por departamentos para el gráfico de pastel
    const porDepto = metricas.reduce((acc: any, curr) => {
      const d = curr.depto.nombre;
      if (!acc[d]) acc[d] = { name: d, value: 0, fill: curr.depto.color };
      acc[d].value += 1;
      return acc;
    }, {});

    return { fugas, scoreGral, deptoData: Object.values(porDepto) };
  }, [metricas]);

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
              KPI <span className="text-blue-500">DEPARTAMENTAL</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 tracking-[0.3em] uppercase">Auditoría de Gastos y Eficiencia por Sector</p>
          </div>
          <button onClick={() => router.push('/reportes')} className="bg-white/5 hover:bg-white hover:text-black px-6 py-2 rounded-full text-[10px] font-black transition-all border border-white/10 uppercase">Volver</button>
        </div>

        {/* TOP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 blur-3xl"></div>
             <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Pérdida por Excesos</p>
             <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white tracking-tighter">{stats.fugas.toFixed(1)}</span>
                <span className="text-rose-500 font-bold uppercase text-xs tracking-tighter">Horas Extra</span>
             </div>
          </div>

          <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-3xl"></div>
             <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Salud Operativa</p>
             <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white tracking-tighter">{stats.scoreGral}%</span>
                <span className="text-blue-500 font-bold uppercase text-xs tracking-tighter">Eficiencia</span>
             </div>
          </div>

          <div className="bg-[#0f172a] p-8 rounded-[32px] border border-white/5 shadow-2xl">
             <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Volumen de Auditoría</p>
             <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white tracking-tighter">{metricas.length}</span>
                <span className="text-emerald-500 font-bold uppercase text-xs tracking-tighter">Registros</span>
             </div>
          </div>
        </div>

        {/* GRÁFICOS INTERMEDIOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* GRÁFICO DE PASTEL POR DEPTO */}
          <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5">
            <h3 className="text-[11px] font-black uppercase text-slate-500 mb-8 tracking-widest">Distribución de Carga de Trabajo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.deptoData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.deptoData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'10px', fontSize:'10px'}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize:'10px', fontWeight:'bold', paddingTop:'20px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RENDIMIENTO HISTÓRICO */}
          <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5">
            <h3 className="text-[11px] font-black uppercase text-slate-500 mb-8 tracking-widest">Variación de Score (Últimos Registros)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...metricas].reverse().slice(-12)}>
                  <XAxis dataKey="fecha_corta" stroke="#334155" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor:'#0f172a', border:'none'}} />
                  <Bar dataKey="eficiencia_score" radius={[6, 6, 6, 6]} barSize={30}>
                    {metricas.map((entry, index) => (
                      <Cell key={index} fill={entry.eficiencia_score > 80 ? '#3b82f6' : '#e11d48'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* LOG DE AUDITORÍA COLORIZADO */}
        <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5">
          <h3 className="text-[11px] font-black uppercase text-slate-400 mb-6 flex items-center gap-3 tracking-widest">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
            Log de Auditoría Detallado
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] text-slate-500 uppercase tracking-widest border-b border-white/5">
                  <th className="pb-4 font-black">Empleado</th>
                  <th className="pb-4 font-black text-center">Departamento</th>
                  <th className="pb-4 font-black text-center">Presencia</th>
                  <th className="pb-4 font-black text-center">Exceso</th>
                  <th className="pb-4 font-black text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {metricas.map((m) => (
                  <tr key={m.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4">
                      <p className="text-[12px] font-black text-white uppercase group-hover:text-blue-400">{m.nombre_empleado}</p>
                      <p className="text-[9px] font-mono text-slate-600">{m.fecha_proceso}</p>
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-[8px] font-black px-3 py-1 rounded-full border border-white/5" style={{color: m.depto.color, borderColor: `${m.depto.color}20`}}>
                        {m.depto.nombre}
                      </span>
                    </td>
                    <td className="py-4 text-center text-[11px] font-bold text-slate-400 font-mono">{m.horas_totales_presencia}h</td>
                    <td className="py-4 text-center">
                      <span className={`text-[11px] font-black ${Number(m.horas_exceso) > 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                        +{m.horas_exceso}h
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <span className={`text-[13px] font-black font-mono ${m.eficiencia_score > 80 ? 'text-blue-500' : 'text-rose-500'}`}>
                        {m.eficiencia_score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}