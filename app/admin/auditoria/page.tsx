'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Radar, RadarChart, PolarGrid, PolarAngleAxis,
  AreaChart, Area
} from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AuditoriaInteligenteQuirurgica() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState<'global' | 'atencion' | 'individual'>('global');
  const [rangoDias, setRangoDias] = useState<number | 'todo'>(7);
  const [busquedaEmpleado, setBusquedaEmpleado] = useState('');
  
  const router = useRouter();

  const getDepto = (nivel: number) => {
    const n = Number(nivel) || 1;
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
        .select('*, empleados:empleado_id ( nombre, rol, nivel_acceso, documento_id )')
        .order('fecha_proceso', { ascending: false });

      if (error) throw error;
      
      const dataProcesada = (data || []).map(m => {
        const emp = m.empleados;
        const nombreBase = emp?.nombre || 'SISTEMA';
        const documento = emp?.documento_id ? `(${emp.documento_id})` : '(SIN ID)';
        
        return {
          ...m,
          nombre_completo_id: `${nombreBase} ${documento}`.trim(),
          nombre_empleado: nombreBase,
          rol_empleado: emp?.rol || 'N/A',
          doc_empleado: emp?.documento_id || '',
          nivel_acceso: emp?.nivel_acceso || 1,
          depto_nombre: getDepto(emp?.nivel_acceso).nombre,
          fecha_corta: m.fecha_proceso ? m.fecha_proceso.split('-').reverse().slice(0, 2).join('/') : '--/--',
          raw_date: new Date(m.fecha_proceso + 'T00:00:00')
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

  const dataFiltradaTemp = useMemo(() => {
    if (rangoDias === 'todo') return metricas;
    const limite = new Date();
    limite.setDate(limite.getDate() - (rangoDias as number));
    limite.setHours(0,0,0,0);
    return metricas.filter(m => m.raw_date >= limite);
  }, [metricas, rangoDias]);

  const dataIndividual = useMemo(() => {
    if (!busquedaEmpleado) return [];
    return [...dataFiltradaTemp].filter(m => 
      m.nombre_empleado.toLowerCase().includes(busquedaEmpleado.toLowerCase()) ||
      m.doc_empleado.includes(busquedaEmpleado)
    ).reverse(); // Reversamos para que la gráfica fluya de izquierda a derecha
  }, [dataFiltradaTemp, busquedaEmpleado]);

  const insightsIA = useMemo(() => {
    const hallazgos: any[] = [];
    const criticos = dataFiltradaTemp.filter(m => m.eficiencia_score < 70);
    const fugasAltas = dataFiltradaTemp.filter(m => m.horas_exceso > 2);

    if (criticos.length > 0) hallazgos.push({ id: 'eficiencia', titulo: 'Rendimiento Crítico', desc: `Detectados ${criticos.length} casos < 70%.`, solucion: 'Auditar puntos de marcación GPS.', nivel: 'CRÍTICO' });
    if (fugasAltas.length > 0) hallazgos.push({ id: 'fuga', titulo: 'Patrón de Fuga', desc: `${fugasAltas.length} registros exceden 2h fuga.`, solucion: 'Revisar solapamiento de turnos.', nivel: 'ALERTA' });
    return hallazgos;
  }, [dataFiltradaTemp]);

  const exportToExcel = () => {
    const exportData = dataFiltradaTemp.map(m => ({
      Fecha: m.fecha_proceso, Empleado: m.nombre_completo_id, Rol: m.rol_empleado, 
      Presencia: m.horas_totales_presencia, Fuga: m.horas_exceso, Eficiencia: `${m.eficiencia_score}%`
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `Reporte_Auditoria_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 border-b border-white/5 pb-6">
          <div className="flex items-center gap-6">
            <button onClick={() => router.back()} className="text-slate-500 hover:text-blue-500 font-bold uppercase text-[10px] tracking-[0.2em] italic transition-all flex items-center gap-2 group">
              <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span> VOLVER ATRÁS
            </button>
            <div>
              <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">AUDITORÍA <span className="text-blue-500">QUIRÚRGICA 2.0</span></h1>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Módulo de Integridad y Diagnóstico IA</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={exportToExcel} className="px-5 py-2.5 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white rounded-xl border border-green-600/20 text-[10px] font-black uppercase transition-all shadow-lg shadow-green-600/5">Descargar Excel</button>
            <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10">
              {[1, 7, 15, 30, 90, 'todo'].map(v => (
                <button key={v} onClick={() => setRangoDias(v as any)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${rangoDias === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{v === 'todo' ? 'Historial' : `${v}D`}</button>
              ))}
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          {[{ id: 'global', label: 'Dashboard Global' }, { id: 'atencion', label: 'Requiere Atención', alert: insightsIA.length > 0 }, { id: 'individual', label: 'Auditoría por Empleado' }].map(tab => (
            <button key={tab.id} onClick={() => setTabActiva(tab.id as any)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${tabActiva === tab.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}>
              {tab.label} {tab.alert && <span className="ml-2 w-2 h-2 bg-rose-500 rounded-full inline-block animate-pulse"></span>}
            </button>
          ))}
        </div>

        {/* CONTENIDO GLOBAL */}
        {tabActiva === 'global' && (
          <div className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Eficiencia Promedio</p>
                <h2 className="text-4xl font-black text-white">{Math.round(dataFiltradaTemp.reduce((a, b) => a + Number(b.eficiencia_score), 0) / (dataFiltradaTemp.length || 1))}%</h2>
              </div>
              <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl"><p className="text-[10px] font-black text-slate-500 uppercase mb-2 text-rose-500">Fuga Total</p><h2 className="text-4xl font-black text-white">{dataFiltradaTemp.reduce((a, b) => a + Number(b.horas_exceso), 0).toFixed(1)}h</h2></div>
              <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl"><p className="text-[10px] font-black text-slate-500 uppercase mb-2 text-blue-400">Registros</p><h2 className="text-4xl font-black text-blue-500">{dataFiltradaTemp.length}</h2></div>
            </div>
            <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="text-[9px] font-black uppercase text-slate-600 tracking-widest bg-black/20 italic"><tr><th className="p-6">Empleado (Identidad) / Rol</th><th className="p-6 text-center">Presencia</th><th className="p-6 text-center">Fuga Extra</th><th className="p-6 text-right">Score</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {dataFiltradaTemp.map((m) => (
                    <tr key={m.id} className="hover:bg-blue-600/5 transition-all group">
                      <td className="p-6"><div className="flex items-center gap-3"><div className={`w-1.5 h-10 rounded-full ${m.eficiencia_score < 70 ? 'bg-rose-500' : 'bg-blue-500'}`}></div><div><p className="text-[12px] font-black text-white uppercase">{m.nombre_completo_id}</p><p className="text-[9px] text-slate-500 font-mono italic">{m.rol_empleado} (Nivel {m.nivel_acceso}) • {m.fecha_proceso}</p></div></div></td>
                      <td className="p-6 text-center text-slate-400 font-mono text-[11px]">{m.horas_totales_presencia}h</td>
                      <td className="p-6 text-center font-black text-rose-500">+{m.horas_exceso}h</td>
                      <td className="p-6 text-right"><div className="flex flex-col items-end"><span className={`text-xl font-black font-mono ${m.eficiencia_score < 70 ? 'text-rose-500' : 'text-blue-500'}`}>{m.eficiencia_score}%</span>{m.eficiencia_score < 70 && <span className="text-[7px] font-black bg-rose-500 text-white px-2 py-0.5 rounded uppercase mt-1">Crítico</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTENIDO: REQUIERE ATENCIÓN */}
        {tabActiva === 'atencion' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {insightsIA.length === 0 ? <div className="col-span-2 p-32 text-center bg-white/5 rounded-[40px] border border-dashed border-white/10"><p className="text-slate-500 font-black uppercase italic tracking-[0.4em]">Sin anomalías detectadas</p></div> : insightsIA.map(h => (
              <div key={h.id} className="bg-[#0f172a] p-8 rounded-[32px] border border-rose-500/20 shadow-2xl group transition-all"><span className={`text-[8px] font-black px-3 py-1 rounded-full ${h.nivel === 'CRÍTICO' ? 'bg-rose-600' : 'bg-amber-600'} text-white`}>{h.nivel}</span><h3 className="text-xl font-black text-white uppercase italic mt-4 mb-2">{h.titulo}</h3><p className="text-slate-400 text-sm mb-6 leading-relaxed">{h.desc}</p><div className="bg-black/40 p-5 rounded-2xl border border-white/5"><p className="text-[9px] font-black text-blue-500 uppercase mb-2 tracking-widest">Sugerencia:</p><p className="text-xs text-slate-300 italic leading-relaxed">"{h.solucion}"</p></div></div>
            ))}
          </div>
        )}

        {/* CONTENIDO: AUDITORÍA INDIVIDUAL CON GRÁFICA */}
        {tabActiva === 'individual' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0f172a] p-10 rounded-[40px] border border-white/5 mb-8 shadow-2xl">
              <input type="text" placeholder="Ej: Juan Pérez o Documento..." value={busquedaEmpleado} onChange={(e) => setBusquedaEmpleado(e.target.value)} className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl text-white font-black text-center text-xl focus:border-blue-600 outline-none transition-all" />
            </div>

            {dataIndividual.length > 0 && (
              <div className="space-y-6">
                {/* Gráfica de Tendencia Individual */}
                <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 shadow-2xl h-[400px]">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-6 italic tracking-widest text-center">Correlación Eficiencia vs Fuga (Línea de Tiempo)</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dataIndividual}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorFuga" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="fecha_corta" stroke="#475569" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#475569" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px'}} />
                      <Area type="monotone" dataKey="eficiencia_score" name="Eficiencia %" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} />
                      <Area type="monotone" dataKey="horas_exceso" name="Horas Fuga" stroke="#f43f5e" fillOpacity={1} fill="url(#colorFuga)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
                  <div className="p-6 bg-blue-600/10 border-b border-white/5 flex justify-between items-center"><h4 className="font-black text-white uppercase italic">{dataIndividual[0].nombre_completo_id}</h4><span className="text-[10px] font-black text-blue-500 uppercase">Rol: {dataIndividual[0].rol_empleado}</span></div>
                  <table className="w-full text-left">
                    <thead className="text-[9px] font-black uppercase text-slate-600 tracking-widest bg-black/20 italic"><tr><th className="p-6">Fecha</th><th className="p-6 text-center">Presencia</th><th className="p-6 text-center">Exceso</th><th className="p-6 text-right">Score</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {dataIndividual.slice().reverse().map(m => ( // Volvemos a invertir para la tabla (más reciente arriba)
                        <tr key={m.id} className="hover:bg-white/5 transition-all"><td className="p-6 font-mono text-slate-400">{m.fecha_proceso}</td><td className="p-6 text-center text-white font-bold">{m.horas_totales_presencia}h</td><td className="p-6 text-center text-rose-500 font-bold">+{m.horas_exceso}h</td><td className="p-6 text-right font-black text-blue-500 text-lg">{m.eficiencia_score}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}