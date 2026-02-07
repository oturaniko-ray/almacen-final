'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
// Importación de componentes de gráficos
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
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
    setLoading(true);
    try {
      // Consulta con Join a la tabla empleados para obtener el nombre
      const { data, error } = await supabase
        .from('reportes_auditoria')
        .select(`
          *,
          empleados ( nombre )
        `)
        .order('fecha_proceso', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        // 1. Cálculos de KPIs
        const totalExceso = data.reduce((acc, curr) => acc + (Number(curr.horas_exceso) || 0), 0);
        const avgEficiencia = data.reduce((acc, curr) => acc + (Number(curr.eficiencia_score) || 0), 0) / data.length;
        const alertasCount = data.filter(d => d.incidencia_tipo !== 'normal').length;

        setResumen({ 
          fugas: totalExceso, 
          eficiencia: Math.round(avgEficiencia), 
          alertas: alertasCount 
        });

        // 2. Mapeo de datos para que Recharts los entienda correctamente
        const dataProcesada = data.map(m => ({
          ...m,
          nombre_empleado: m.empleados?.nombre || 'Desconocido',
          // Acortamos la fecha para el eje X (YYYY-MM-DD -> DD/MM)
          fecha_corta: m.fecha_proceso.split('-').reverse().slice(0, 2).join('/')
        }));

        setMetricas(dataProcesada);
      }
    } catch (err) {
      console.error("Error en Auditoría:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="text-blue-500 font-black animate-pulse uppercase tracking-widest">Iniciando Auditoría...</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] p-6 text-slate-200 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER DE ALTA GERENCIA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-white/5 pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">
              CONTROL DE <span className="text-blue-500">AUDITORÍA OPERATIVA</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Motor de Análisis de Rendimiento • Nivel Senior
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchAuditoria}
              className="bg-blue-600/10 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all"
            >
              🔄 Refrescar
            </button>
            <button 
              onClick={() => router.push('/reportes')}
              className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/10 hover:bg-white hover:text-black transition-all"
            >
              REGRESAR
            </button>
          </div>
        </div>

        {/* INDICADORES KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-rose-500/20 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="w-12 h-12 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/></svg>
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Fuga de Horas (Excesos)</p>
            <h2 className="text-4xl font-black text-rose-500 font-mono tracking-tighter">{resumen.fugas.toFixed(1)}h</h2>
            <p className="text-[9px] text-rose-500/50 mt-2 font-bold uppercase">Impacto en Presupuesto Mensual</p>
          </div>
          
          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-blue-500/20 shadow-lg relative overflow-hidden group">
            <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Score de Eficiencia Global</p>
            <h2 className="text-4xl font-black text-blue-500 font-mono tracking-tighter">{resumen.eficiencia}%</h2>
            <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${resumen.eficiencia}%` }}></div>
            </div>
          </div>

          <div className="bg-[#0f172a] p-6 rounded-[24px] border border-lime-500/20 shadow-lg">
            <p className="text-slate-500 text-[10px] font-black uppercase mb-1">Alertas Críticas</p>
            <h2 className="text-4xl font-black text-lime-400 font-mono tracking-tighter">{resumen.alertas}</h2>
            <p className="text-[9px] text-lime-500/50 mt-2 font-bold uppercase">Incidencias Fuera de Rango</p>
          </div>
        </div>

        {/* GRÁFICOS Y LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* GRÁFICO DE BARRAS */}
          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5 shadow-xl">
            <h3 className="text-[11px] font-black uppercase mb-6 text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Rendimiento por Jornada (Score)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricas.slice(0, 15).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="fecha_corta" stroke="#475569" fontSize={10} fontWeight="bold" />
                  <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} />
                  <Tooltip 
                    cursor={{fill: '#1e293b'}}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '10px' }}
                  />
                  <Bar dataKey="eficiencia_score" radius={[4, 4, 0, 0]}>
                    {metricas.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.eficiencia_score > 85 ? '#3b82f6' : entry.eficiencia_score > 60 ? '#fbbf24' : '#e11d48'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* LISTADO DE AUDITORÍA (LOG) */}
          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5 shadow-xl flex flex-col">
            <h3 className="text-[11px] font-black uppercase mb-6 text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
              Historial de Incidencias Recientes
            </h3>
            <div className="overflow-y-auto flex-1 max-h-[288px] pr-2 custom-scrollbar">
              {metricas.length === 0 ? (
                <p className="text-center text-slate-600 text-xs mt-10 uppercase font-black tracking-widest">Sin registros auditados</p>
              ) : (
                metricas.map((m) => (
                  <div key={m.id} className="flex justify-between items-center p-4 mb-3 bg-black/40 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group">
                    <div>
                      <p className="text-[11px] font-black text-white uppercase group-hover:text-blue-400 transition-colors">{m.nombre_empleado}</p>
                      <div className="flex gap-2 mt-1">
                        <p className="text-[9px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded-md">{m.fecha_proceso}</p>
                        <p className="text-[9px] text-blue-500 font-bold uppercase tracking-tighter">{m.horas_totales_presencia}h Laboradas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-[9px] font-black uppercase mb-1 ${m.incidencia_tipo === 'normal' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {m.incidencia_tipo.replace('_', ' ')}
                      </p>
                      <p className={`text-[14px] font-black font-mono ${m.eficiencia_score > 80 ? 'text-blue-500' : 'text-rose-400'}`}>
                        {m.eficiencia_score} <span className="text-[8px]">PTS</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </main>
  );
}