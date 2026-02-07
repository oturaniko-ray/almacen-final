'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line 
} from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AuditoriaDashboard() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [resumen, setResumen] = useState({ fugas: 0, eficiencia: 0, alertas: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchAuditoria();
  }, []);

  const fetchAuditoria = async () => {
    // 1. Obtener últimos 30 días de auditoría
    const { data, error } = await supabase
      .from('reportes_auditoria')
      .select('*, empleados(nombre)')
      .order('fecha_proceso', { ascending: false })
      .limit(100);

    if (data) {
      // Procesar datos para gráficos
      const totalExceso = data.reduce((acc, curr) => acc + (curr.horas_exceso || 0), 0);
      const avgEficiencia = data.reduce((acc, curr) => acc + curr.eficiencia_score, 0) / data.length;
      const alertasCount = data.filter(d => d.incidencia_tipo !== 'normal').length;

      setResumen({ 
        fugas: totalExceso, 
        eficiencia: Math.round(avgEficiencia || 0), 
        alertas: alertasCount 
      });
      setMetricas(data);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#020617] p-6 text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER DE ALTA GERENCIA */}
        <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">
              CONTROL DE <span className="text-blue-500">AUDITORÍA OPERATIVA</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Análisis de rendimiento y optimización de gastos
            </p>
          </div>
          <button 
            onClick={() => router.push('/reportes')}
            className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/10 hover:bg-white hover:text-black transition-all"
          >
            REGRESAR AL PANEL
          </button>
        </div>

        {/* INDICADORES KPI (Bento Grid Style) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-rose-500/20 shadow-lg">
            <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Fuga de Horas (Mes)</p>
            <h2 className="text-4xl font-black text-rose-500 font-mono">{resumen.fugas.toFixed(1)}h</h2>
            <p className="text-[9px] text-rose-500/50 mt-2 font-bold">HORAS EXCEDIDAS DETECTADAS</p>
          </div>
          
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-blue-500/20 shadow-lg">
            <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Eficiencia Global</p>
            <h2 className="text-4xl font-black text-blue-500 font-mono">{resumen.eficiencia}%</h2>
            <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${resumen.eficiencia}%` }}></div>
            </div>
          </div>

          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-lime-500/20 shadow-lg">
            <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Alertas Críticas</p>
            <h2 className="text-4xl font-black text-lime-400 font-mono">{resumen.alertas}</h2>
            <p className="text-[9px] text-lime-500/50 mt-2 font-bold">INCIDENCIAS QUE REQUIEREN REVISIÓN</p>
          </div>
        </div>

        {/* GRÁFICOS DE ANÁLISIS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
            <h3 className="text-[11px] font-black uppercase mb-6 text-slate-400">Distribución de Score por Jornada</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricas.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="fecha_proceso" stroke="#475569" fontSize={10} tickFormatter={(v) => v.split('-').slice(1,3).join('/')} />
                  <YAxis stroke="#475569" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="eficiencia_score" radius={[4, 4, 0, 0]}>
                    {metricas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.eficiencia_score > 80 ? '#3b82f6' : '#e11d48'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
            <h3 className="text-[11px] font-black uppercase mb-6 text-slate-400">Log de Auditoría Reciente</h3>
            <div className="overflow-y-auto h-64 pr-2 custom-scrollbar">
              {metricas.map((m) => (
                <div key={m.id} className="flex justify-between items-center p-3 mb-2 bg-black/20 rounded-xl border border-white/5">
                  <div>
                    <p className="text-[11px] font-black text-white uppercase">{m.empleados?.nombre}</p>
                    <p className="text-[9px] text-slate-500 font-mono">{m.fecha_proceso}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-black uppercase ${m.incidencia_tipo === 'normal' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {m.incidencia_tipo}
                    </p>
                    <p className="text-[12px] font-black text-blue-500">{m.eficiencia_score} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </main>
  );
}