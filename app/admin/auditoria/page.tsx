'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AuditoriaInteligenteQuirurgica() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabActiva, setTabActiva] = useState<'global' | 'atencion' | 'individual'>('global');
  const [rangoDias, setRangoDias] = useState<number | 'todo'>(7);
  const [busquedaEmpleado, setBusquedaEmpleado] = useState('');
  const [checksValidados, setChecksValidados] = useState<Record<string, boolean>>({});
  
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
    ).reverse();
  }, [dataFiltradaTemp, busquedaEmpleado]);

  const insightsIA = useMemo(() => {
    const hallazgos: any[] = [];
    const criticos = dataFiltradaTemp.filter(m => m.eficiencia_score < 70);
    const fugasAltas = dataFiltradaTemp.filter(m => m.horas_exceso > 2);

    criticos.forEach((m) => {
      const id = `eficiencia-${m.id}`;
      hallazgos.push({
        id,
        titulo: `Baja Eficiencia: ${m.nombre_completo_id}`,
        desc: `Registró ${m.eficiencia_score}% el ${m.fecha_proceso}.`,
        solucion: 'Verificar estabilidad de conexión GPS.',
        nivel: 'CRÍTICO'
      });
    });

    fugasAltas.forEach((m) => {
      const id = `fuga-${m.id}`;
      hallazgos.push({
        id,
        titulo: `Exceso de Fuga: ${m.nombre_completo_id}`,
        desc: `Detectadas ${m.horas_exceso}h de fuga extra.`,
        solucion: 'Revisar solapamiento de turnos.',
        nivel: 'ALERTA'
      });
    });

    return hallazgos.filter(h => !checksValidados[h.id]);
  }, [dataFiltradaTemp, checksValidados]);

  const toggleCheck = (id: string) => {
    setChecksValidados(prev => ({ ...prev, [id]: true }));
  };

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

  // Identidad del Operador Logueado para el Membrete
  const operador = useMemo(() => {
    if (metricas.length === 0) return { nombre: 'SESIÓN ACTIVA', rol: 'ADMINISTRADOR', nivel: 'S/N' };
    const ref = metricas[0]; // Se asume el primer registro como contexto de sesión por RLS
    return {
      nombre: ref.nombre_empleado,
      rol: ref.rol_empleado,
      nivel: ref.nivel_acceso
    };
  }, [metricas]);

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        
        {/* MEMBRETE: OPERADOR LOGUEADO */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6 border-b border-white/5 pb-6 shrink-0">
          <div>
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">CENTRO DE <span className="text-blue-500">AUDITORÍA</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1 italic">
              OPERADOR: {operador.nombre} - <span className="text-blue-400">{operador.rol}</span> (<span className="text-blue-400">NIVEL {operador.nivel}</span>)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={exportToExcel} className="px-5 py-2.5 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white rounded-xl border border-green-600/20 text-[10px] font-black uppercase transition-all">Descargar Excel</button>
            <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10">
              {[1, 7, 15, 30, 90, 'todo'].map(v => (
                <button key={v} onClick={() => setRangoDias(v as any)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${rangoDias === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{v === 'todo' ? 'Historial' : `${v}D`}</button>
              ))}
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN Y BOTÓN VOLVER */}
        <div className="flex items-center justify-between gap-4 mb-6 shrink-0">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[{ id: 'global', label: 'Dashboard Global' }, { id: 'atencion', label: 'Requiere Atención', alert: insightsIA.length > 0 }, { id: 'individual', label: 'Auditoría por Empleado' }].map(tab => (
              <button key={tab.id} onClick={() => setTabActiva(tab.id as any)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${tabActiva === tab.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}>
                {tab.label} {tab.alert && <span className="ml-2 w-2 h-2 bg-rose-500 rounded-full inline-block animate-pulse"></span>}
              </button>
            ))}
          </div>
          <button onClick={() => router.back()} className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-500 hover:text-blue-500 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 group">
            <span className="group-hover:-translate-x-1 transition-transform">←</span> VOLVER ATRÁS
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          
          {tabActiva === 'global' && (
            <div className="flex flex-col h-full space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Eficiencia Promedio</p>
                  <h2 className="text-4xl font-black text-white">{Math.round(dataFiltradaTemp.reduce((a, b) => a + Number(b.eficiencia_score), 0) / (dataFiltradaTemp.length || 1))}%</h2>
                </div>
                <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl"><p className="text-[10px] font-black text-slate-500 uppercase mb-2 text-rose-500">Fuga Total</p><h2 className="text-4xl font-black text-white">{dataFiltradaTemp.reduce((a, b) => a + Number(b.horas_exceso), 0).toFixed(1)}h</h2></div>
                <div className="bg-[#0f172a] p-6 rounded-[24px] border border-white/5 shadow-xl"><p className="text-[10px] font-black text-slate-500 uppercase mb-2 text-blue-400">Registros</p><h2 className="text-4xl font-black text-blue-500">{dataFiltradaTemp.length}</h2></div>
              </div>
              <div className="flex-1 overflow-y-auto bg-[#0f172a] rounded-[32px] border border-white/5 shadow-2xl custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 text-[9px] font-black uppercase text-slate-600 tracking-widest bg-[#1e293b] italic">
                    <tr><th className="p-6">Empleado (Identidad) / Rol</th><th className="p-6 text-center">Presencia</th><th className="p-6 text-center">Fuga Extra</th><th className="p-6 text-right">Score</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {dataFiltradaTemp.map((m) => (
                      <tr key={m.id} className="hover:bg-blue-600/5 transition-all group">
                        <td className="p-6"><div className="flex items-center gap-3"><div className={`w-1.5 h-10 rounded-full ${m.eficiencia_score < 70 ? 'bg-rose-500' : 'bg-blue-500'}`}></div><div><p className="text-[12px] font-black text-white uppercase">{m.nombre_completo_id}</p><p className="text-[9px] text-slate-500 font-mono italic">{m.rol_empleado} (Nivel {m.nivel_acceso}) • {m.fecha_proceso}</p></div></div></td>
                        <td className="p-6 text-center text-slate-400 font-mono text-[11px]">{m.horas_totales_presencia}h</td>
                        <td className="p-6 text-center font-black text-rose-500">+{m.horas_exceso}h</td>
                        <td className="p-6 text-right font-black text-blue-500 text-xl font-mono">{m.eficiencia_score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tabActiva === 'atencion' && (
            <div className="h-full overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {insightsIA.length === 0 ? (
                <div className="p-32 text-center bg-white/5 rounded-[40px] border border-dashed border-white/10">
                  <p className="text-slate-500 font-black uppercase italic tracking-[0.4em]">Sin anomalías pendientes de validación</p>
                </div>
              ) : (
                insightsIA.map(h => (
                  <div key={h.id} className="bg-[#0f172a] p-6 rounded-[28px] border border-white/5 flex items-start gap-6 hover:border-blue-500/30 transition-all">
                    <button onClick={() => toggleCheck(h.id)} className="mt-1 w-8 h-8 rounded-xl border-2 border-slate-700 flex items-center justify-center hover:border-green-500 transition-colors shrink-0">
                      <span className="text-transparent hover:text-green-500 font-bold">✓</span>
                    </button>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-[8px] font-black px-3 py-1 rounded-full ${h.nivel === 'CRÍTICO' ? 'bg-rose-600' : 'bg-amber-600'} text-white`}>{h.nivel}</span>
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest italic">Sugerencia: {h.solucion}</p>
                      </div>
                      <h3 className="text-lg font-black text-white uppercase italic mb-1">{h.titulo}</h3>
                      <p className="text-slate-400 text-xs leading-relaxed">{h.desc}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tabActiva === 'individual' && (
            <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-[#0f172a] p-6 rounded-[32px] border border-white/5 mb-8 flex items-center gap-4">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Buscar Auditado por Nombre o Documento..." 
                    value={busquedaEmpleado} 
                    onChange={(e) => setBusquedaEmpleado(e.target.value)} 
                    className="w-full bg-black/40 border border-white/10 p-5 pr-14 rounded-2xl text-white font-black text-xl focus:border-blue-600 outline-none transition-all" 
                  />
                  {busquedaEmpleado && (
                    <button 
                      onClick={() => setBusquedaEmpleado('')}
                      className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all font-black"
                    >✕</button>
                  )}
                </div>
              </div>

              {dataIndividual.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                  <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dataIndividual}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="fecha_corta" stroke="#475569" fontSize={10} />
                          <YAxis stroke="#475569" fontSize={10} />
                          <Tooltip contentStyle={{backgroundColor: '#020617', border: 'none', borderRadius: '16px'}} />
                          <Area type="monotone" dataKey="eficiencia_score" stroke="#3b82f6" fill="url(#colorScore)" strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* BADGE DE IDENTIDAD DEL AUDITADO */}
                    <div className="mt-8 flex justify-center">
                      <div className="bg-black/60 px-8 py-4 rounded-3xl border border-blue-500/20 text-center">
                        <p className="text-xl font-black text-white uppercase tracking-tighter">
                          {dataIndividual[0].nombre_empleado}
                        </p>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-1">
                          DOCUMENTO: {dataIndividual[0].doc_empleado} • ROL: {dataIndividual[0].rol_empleado}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0f172a] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
                    <table className="w-full text-left">
                      <thead className="text-[9px] font-black uppercase text-slate-600 bg-black/20">
                        <tr><th className="p-6">Fecha</th><th className="p-6 text-center">Presencia</th><th className="p-6 text-center text-rose-500">Fuga</th><th className="p-6 text-right">Score</th></tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dataIndividual.slice().reverse().map(m => (
                          <tr key={m.id} className="hover:bg-white/5 transition-all">
                            <td className="p-6 font-mono text-slate-400">{m.fecha_proceso}</td>
                            <td className="p-6 text-center text-white font-bold">{m.horas_totales_presencia}h</td>
                            <td className="p-6 text-center text-rose-500 font-bold">+{m.horas_exceso}h</td>
                            <td className="p-6 text-right font-black text-blue-500 text-lg">{m.eficiencia_score}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}</style>
    </main>
  );
}