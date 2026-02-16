'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// ------------------------------------------------------------
// FUNCIONES AUXILIARES (DEFINIDAS PRIMERO)
// ------------------------------------------------------------

// Función para formatear rol
const formatearRol = (rol: string): string => {
  if (!rol) return 'USUARIO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin': case 'administrador': return 'ADMIN';
    case 'supervisor': return 'SUPERV';
    case 'tecnico': return 'TECNICO';
    case 'empleado': return 'EMPLEADO';
    default: return rol.toUpperCase();
  }
};

// ------------------------------------------------------------
// COMPONENTES VISUALES
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR -----
const MemebreteSuperior = ({ usuario, onRegresar }: { usuario?: any; onRegresar: () => void }) => {
  const titulo = "AUDITORÍA ANALÍTICA";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="relative w-full mb-6">
      <div className="w-full max-w-sm bg-[#1a1a1a] p-5 rounded-[25px] border border-white/5 text-center shadow-2xl mx-auto">
        <h1 className="text-xl font-black italic uppercase tracking-tighter">
          <span className="text-white">{primerasPalabras} </span>
          <span className="text-blue-700">{ultimaPalabra}</span>
        </h1>
        {usuario && (
          <div className="mt-1 text-sm">
            <span className="text-white">{usuario.nombre}</span>
            <span className="text-white mx-1">•</span>
            <span className="text-blue-500">{formatearRol(usuario.rol)}</span>
            <span className="text-white ml-1">({usuario.nivel_acceso})</span>
          </div>
        )}
      </div>
      <div className="absolute top-0 right-0 mt-4 mr-4">
        <button
          onClick={onRegresar}
          className="bg-blue-800 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
        >
          REGRESAR
        </button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function AuditoriaInteligenteQuirurgica() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tabActiva, setTabActiva] = useState<'global' | 'atencion' | 'individual'>('global');
  const [rangoDias, setRangoDias] = useState<number | 'todo'>(7);
  const [busquedaEmpleado, setBusquedaEmpleado] = useState('');
  const [checksValidados, setChecksValidados] = useState<Record<string, boolean>>({});
  const [usuarioLogueado, setUsuarioLogueado] = useState<{nombre: string, rol: string, nivel_acceso: any} | null>(null);
  const [umbralEfectividad, setUmbralEfectividad] = useState<number>(70);
  const [filtroEficiencia, setFiltroEficiencia] = useState<string>('todos');
  
  const router = useRouter();

  // ------------------------------------------------------------
  // CARGAR CONFIGURACIÓN
  // ------------------------------------------------------------
  const fetchUmbral = useCallback(async () => {
    const { data } = await supabase
      .from('sistema_config')
      .select('valor')
      .eq('clave', 'porcentaje_efectividad')
      .maybeSingle();
    if (data) {
      const val = parseInt(data.valor, 10);
      if (!isNaN(val)) setUmbralEfectividad(val);
    }
  }, []);

  const fetchUserSession = useCallback(async () => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      setUsuarioLogueado({
        nombre: parsed.nombre,
        rol: parsed.rol || parsed.nivel_acceso_nombre || 'USUARIO',
        nivel_acceso: parsed.nivel_acceso || 1
      });
    }
  }, []);

  const fetchAuditoria = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('reportes_auditoria')
        .select('*, empleados:empleado_id ( nombre, rol, nivel_acceso, documento_id )')
        .order('fecha_proceso', { ascending: false });

      if (error) throw error;
      
      const dataProcesada = (data || []).map(m => {
        const emp = m.empleados;
        const nombreBase = emp?.nombre || 'SISTEMA';
        return {
          ...m,
          nombre_completo_id: `${nombreBase} (${emp?.documento_id || 'S/ID'})`,
          nombre_empleado: nombreBase,
          rol_empleado: emp?.rol || 'N/A',
          doc_empleado: emp?.documento_id || '',
          nivel_acceso: emp?.nivel_acceso || 1,
          fecha_corta: m.fecha_proceso ? m.fecha_proceso.split('-').reverse().slice(0, 2).join('/') : '--/--',
          raw_date: new Date(m.fecha_proceso + 'T00:00:00')
        };
      });

      setMetricas(dataProcesada);
    } catch (err) {
      console.error("Falla en Auditoría:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserSession();
    fetchUmbral();
    fetchAuditoria();

    const canalAuditoria = supabase
      .channel('cambios-auditoria')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reportes_auditoria' }, () => {
        fetchAuditoria(true); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalAuditoria);
    };
  }, [fetchAuditoria, fetchUserSession, fetchUmbral]);

  // ------------------------------------------------------------
  // CÁLCULOS Y FILTROS
  // ------------------------------------------------------------
  const dataFiltradaTemp = useMemo(() => {
    if (rangoDias === 'todo') return metricas;
    const limite = new Date();
    limite.setDate(limite.getDate() - (rangoDias as number));
    limite.setHours(0,0,0,0);
    return metricas.filter(m => m.raw_date >= limite);
  }, [metricas, rangoDias]);

  const dataFiltrada = useMemo(() => {
    if (filtroEficiencia === 'todos') return dataFiltradaTemp;
    const umbral = umbralEfectividad;
    return dataFiltradaTemp.filter(m => {
      const score = Number(m.eficiencia_score);
      if (filtroEficiencia === 'bajo') return score < umbral;
      if (filtroEficiencia === 'medio') return score >= umbral && score <= 85;
      if (filtroEficiencia === 'alto') return score > 85;
      return true;
    });
  }, [dataFiltradaTemp, filtroEficiencia, umbralEfectividad]);

  const dataIndividual = useMemo(() => {
    if (!busquedaEmpleado) return [];
    return [...dataFiltrada].filter(m => 
      m.nombre_empleado.toLowerCase().includes(busquedaEmpleado.toLowerCase()) ||
      m.doc_empleado.includes(busquedaEmpleado)
    ).reverse();
  }, [dataFiltrada, busquedaEmpleado]);

  const insightsIA = useMemo(() => {
    const hallazgos: any[] = [];
    dataFiltrada.forEach((m) => {
      if (m.eficiencia_score < umbralEfectividad) {
        hallazgos.push({
          id: `eficiencia-${m.id}`,
          titulo: `Baja Eficiencia: ${m.nombre_completo_id}`,
          desc: `Registró ${m.eficiencia_score}% el ${m.fecha_proceso}.`,
          solucion: 'Verificar estabilidad de conexión GPS.',
          nivel: 'CRÍTICO'
        });
      }
      if (m.horas_exceso > 2) {
        hallazgos.push({
          id: `fuga-${m.id}`,
          titulo: `Exceso de Fuga: ${m.nombre_completo_id}`,
          desc: `Detectadas ${m.horas_exceso}h de fuga extra.`,
          solucion: 'Revisar solapamiento de turnos.',
          nivel: 'ALERTA'
        });
      }
    });
    return hallazgos.filter(h => !checksValidados[h.id]);
  }, [dataFiltrada, checksValidados, umbralEfectividad]);

  const kpis = useMemo(() => {
    const totalRegistros = dataFiltrada.length;
    const eficienciaPromedio = totalRegistros
      ? Math.round(dataFiltrada.reduce((a, b) => a + Number(b.eficiencia_score), 0) / totalRegistros)
      : 0;
    const totalHorasExtras = dataFiltrada.reduce((a, b) => a + Number(b.horas_exceso), 0).toFixed(1);
    const jornadasConExceso = dataFiltrada.filter(m => Number(m.horas_exceso) > 0).length;
    const porcentajeExceso = totalRegistros ? Math.round((jornadasConExceso / totalRegistros) * 100) : 0;

    let masEficiente = { nombre: 'N/A', score: 0 };
    let menosEficiente = { nombre: 'N/A', score: 100 };
    if (totalRegistros > 0) {
      const scores = dataFiltrada.map(m => ({ nombre: m.nombre_empleado, score: Number(m.eficiencia_score) }));
      masEficiente = scores.reduce((max, s) => s.score > max.score ? s : max, { nombre: '', score: 0 });
      menosEficiente = scores.reduce((min, s) => s.score < min.score ? s : min, { nombre: '', score: 100 });
    }

    return {
      eficienciaPromedio,
      totalHorasExtras,
      porcentajeExceso,
      masEficiente,
      menosEficiente
    };
  }, [dataFiltrada]);

  // ------------------------------------------------------------
  // MANEJADORES
  // ------------------------------------------------------------
  const toggleCheck = (id: string) => setChecksValidados(prev => ({ ...prev, [id]: true }));
  const limpiarTodo = () => {
    const todos: Record<string, boolean> = {};
    insightsIA.forEach(h => todos[h.id] = true);
    setChecksValidados(prev => ({ ...prev, ...todos }));
  };

  const handleRegresar = () => {
    router.back();
  };

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-[#020617] p-4 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        
        {/* HEADER */}
        <MemebreteSuperior usuario={usuarioLogueado || undefined} onRegresar={handleRegresar} />

        {/* BARRA DE HERRAMIENTAS - debajo del header */}
        <div className="flex items-center justify-between gap-4 mb-4 shrink-0 bg-[#0f172a] p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchAuditoria(true)} 
              disabled={isRefreshing}
              className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white transition-all group"
              title="Sincronizar ahora"
            >
              <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : 'group-active:rotate-180 transition-transform'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {[7, 15, 30, 'todo'].map(v => (
                <button key={v} onClick={() => setRangoDias(v as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${rangoDias === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{v === 'todo' ? 'TODO' : `${v}D`}</button>
              ))}
            </div>
            
            {/* INDICADOR DE UMBRAL DE EFECTIVIDAD */}
            <div className="ml-2 flex items-center gap-1 bg-blue-600/10 px-3 py-1.5 rounded-lg border border-blue-500/30">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider">UMBRAL:</span>
              <span className="text-sm font-black text-blue-500">{umbralEfectividad}%</span>
            </div>
          </div>

          <div className="flex gap-1">
            {[
              { id: 'global', label: 'GLOBAL' }, 
              { id: 'atencion', label: 'ATENCIÓN IA', alert: insightsIA.length > 0 }, 
              { id: 'individual', label: 'POR EMPLEADO' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setTabActiva(tab.id as any)} 
                className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border ${tabActiva === tab.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}>
                {tab.label} {tab.alert && <span className="ml-1 w-2 h-2 bg-rose-500 rounded-full inline-block animate-pulse"></span>}
              </button>
            ))}
          </div>

          {tabActiva === 'global' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400">FILTRAR:</span>
              <select
                value={filtroEficiencia}
                onChange={(e) => setFiltroEficiencia(e.target.value)}
                className="bg-white/5 border border-white/10 p-1.5 rounded-lg text-[10px] font-black text-white outline-none focus:border-blue-500/50"
              >
                <option value="todos">TODOS</option>
                <option value="bajo">&lt;{umbralEfectividad}%</option>
                <option value="medio">{umbralEfectividad}-85%</option>
                <option value="alto">&gt;85%</option>
              </select>
            </div>
          )}
        </div>

        {/* RESTO DEL CÓDIGO IGUAL... */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {tabActiva === 'global' && (
                <div className="flex flex-col h-full space-y-4 overflow-y-auto custom-scrollbar pr-2">
                  {/* KPIs */}
                  <div className="grid grid-cols-5 gap-3 shrink-0">
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase">EFIC PROM</p>
                      <p className="text-2xl font-black text-white">{kpis.eficienciaPromedio}%</p>
                    </div>
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-rose-400 uppercase">HRS EXTRAS</p>
                      <p className="text-2xl font-black text-white">{kpis.totalHorasExtras}h</p>
                    </div>
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-amber-400 uppercase">% EXCESO</p>
                      <p className="text-2xl font-black text-white">{kpis.porcentajeExceso}%</p>
                    </div>
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-emerald-400 uppercase">MEJOR</p>
                      <p className="text-[11px] font-black text-white truncate">{kpis.masEficiente.nombre}</p>
                      <p className="text-base font-black text-emerald-400">{kpis.masEficiente.score}%</p>
                    </div>
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-rose-400 uppercase">PEOR</p>
                      <p className="text-[11px] font-black text-white truncate">{kpis.menosEficiente.nombre}</p>
                      <p className="text-base font-black text-rose-400">{kpis.menosEficiente.score}%</p>
                    </div>
                  </div>

                  {/* Tabla */}
                  <div className="flex-1 overflow-y-auto bg-[#0f172a] rounded-lg border border-white/5 custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10 text-[10px] font-black uppercase text-slate-600 bg-[#1e293b]">
                        <tr>
                          <th className="p-3">EMPLEADO / ROL</th>
                          <th className="p-3 text-center">PRESENCIA</th>
                          <th className="p-3 text-center">FUGA</th>
                          <th className="p-3 text-right">SCORE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dataFiltrada.map((m) => (
                          <tr key={m.id} className="hover:bg-blue-600/5">
                            <td className="p-3">
                              <p className="text-[12px] font-black text-white uppercase">{m.nombre_completo_id}</p>
                              <p className="text-[9px] text-slate-500">{m.rol_empleado} • {m.fecha_proceso}</p>
                            </td>
                            <td className="p-3 text-center text-slate-400 font-mono text-[11px]">{m.horas_totales_presencia}h</td>
                            <td className="p-3 text-center font-black text-rose-500 text-[11px]">+{m.horas_exceso}h</td>
                            <td className="p-3 text-right font-black text-blue-500 text-lg font-mono">{m.eficiencia_score}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tabActiva === 'atencion' && (
                <div className="h-full flex flex-col">
                  <div className="flex justify-between items-center mb-3 shrink-0">
                    <p className="text-[11px] font-black text-slate-500 uppercase">PENDIENTES: {insightsIA.length}</p>
                    {insightsIA.length > 0 && (
                      <button onClick={limpiarTodo} className="text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1.5 rounded-lg hover:bg-rose-500 hover:text-white transition-all uppercase">LIMPIAR TODO</button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {insightsIA.length === 0 ? (
                      <div className="p-10 text-center bg-white/5 rounded-lg border border-dashed border-white/10">
                        <p className="text-slate-500 font-black uppercase italic text-[11px]">SIN ALERTAS PENDIENTES</p>
                      </div>
                    ) : (
                      insightsIA.map(h => (
                        <div key={h.id} className="bg-[#0f172a] p-4 rounded-lg border border-white/5 flex items-start gap-4 hover:border-blue-500/30">
                          <button onClick={() => toggleCheck(h.id)} className="mt-1 w-7 h-7 rounded-lg border-2 border-slate-700 flex items-center justify-center hover:border-green-500 shrink-0">
                            <span className="text-transparent hover:text-green-500 font-bold text-sm">✓</span>
                          </button>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                              <span className={`text-[9px] font-black px-3 py-1 rounded-full ${h.nivel === 'CRÍTICO' ? 'bg-rose-600' : 'bg-amber-600'} text-white`}>{h.nivel}</span>
                              <p className="text-[10px] font-black text-blue-500 uppercase italic">SUGERENCIA: {h.solucion}</p>
                            </div>
                            <h3 className="text-base font-black text-white uppercase italic mb-1">{h.titulo}</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">{h.desc}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tabActiva === 'individual' && (
                <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                  <div className="bg-[#0f172a] p-4 rounded-lg border border-white/5 mb-4">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="BUSCAR EMPLEADO..." 
                        value={busquedaEmpleado} 
                        onChange={(e) => setBusquedaEmpleado(e.target.value)} 
                        className="w-full bg-black/40 border border-white/10 p-3 pr-10 rounded-lg text-white font-black text-base outline-none focus:border-blue-500"
                      />
                      {busquedaEmpleado && (
                        <button onClick={() => setBusquedaEmpleado('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white text-sm">✕</button>
                      )}
                    </div>
                  </div>

                  {dataIndividual.length > 0 && (
                    <div className="space-y-4 pb-4">
                      <div className="bg-[#0f172a] p-6 rounded-lg border border-white/5">
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dataIndividual}>
                              <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis dataKey="fecha_corta" stroke="#475569" fontSize={11} />
                              <YAxis stroke="#475569" fontSize={11} />
                              <Tooltip contentStyle={{backgroundColor: '#020617', border: 'none', borderRadius: '8px', fontSize: '11px'}} />
                              <Area type="monotone" dataKey="eficiencia_score" stroke="#3b82f6" fill="url(#colorScore)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex justify-center">
                          <div className="bg-black/60 px-6 py-3 rounded-lg border border-blue-500/20 text-center">
                            <p className="text-lg font-black text-white uppercase">{dataIndividual[0].nombre_empleado}</p>
                            <p className="text-[11px] font-black text-blue-500 mt-1">DOC: {dataIndividual[0].doc_empleado} • ROL: {dataIndividual[0].rol_empleado}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}</style>
    </main>
  );
}