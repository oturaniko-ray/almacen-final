'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// ------------------------------------------------------------
// FUNCIONES AUXILIARES (DEFINIDAS PRIMERO)
// ------------------------------------------------------------

// Función para formatear rol
const formatearRol = (rol: string): string => {
  if (!rol) return 'CONDUCTOR';
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
  const titulo = "AUDITORÍA DE FLOTA";
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
      {/* Botón de regreso - reposicionado para evitar solapamiento */}
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
export default function AuditoriaFlota() {
  const [metricas, setMetricas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tabActiva, setTabActiva] = useState<'global' | 'atencion' | 'individual' | 'efectividad'>('global');
  const [rangoDias, setRangoDias] = useState<number | 'todo'>(7);
  const [busquedaPerfil, setBusquedaPerfil] = useState('');
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
      const { data: accesos, error } = await supabase
        .from('flota_accesos')
        .select(`
          *,
          flota_perfil:perfil_id ( 
            nombre_completo, 
            documento_id, 
            nombre_flota,
            cant_rutas 
          )
        `)
        .order('hora_llegada', { ascending: false });

      if (error) throw error;
      
      const dataProcesada = (accesos || []).map(acceso => {
        const perfil = acceso.flota_perfil;
        const nombreBase = perfil?.nombre_completo || 'SISTEMA';
        
        const horaSalida = acceso.hora_salida ? new Date(acceso.hora_salida) : null;
        const horaLlegada = new Date(acceso.hora_llegada);
        const tiempoPatioMs = horaSalida ? horaSalida.getTime() - horaLlegada.getTime() : 0;
        const tiempoPatioHoras = tiempoPatioMs > 0 ? tiempoPatioMs / (1000 * 60 * 60) : 0;
        
        const tiempoLimiteHoras = 4;
        const horasExceso = Math.max(0, tiempoPatioHoras - tiempoLimiteHoras);
        
        const rutasAsignadas = perfil?.cant_rutas || 0;
        const cargaReal = acceso.cant_carga || 0;
        const diferenciaCarga = rutasAsignadas - cargaReal;
        const efectividadCarga = rutasAsignadas > 0 ? Math.round((cargaReal / rutasAsignadas) * 100) : 0;
        
        return {
          ...acceso,
          nombre_completo_id: `${nombreBase} (${perfil?.documento_id || 'S/ID'})`,
          nombre_perfil: nombreBase,
          doc_perfil: perfil?.documento_id || '',
          flota_nombre: perfil?.nombre_flota || '',
          rutas_asignadas: rutasAsignadas,
          carga_real: cargaReal,
          diferencia_carga: diferenciaCarga,
          efectividad_carga: efectividadCarga,
          tiempo_patio_horas: Math.round(tiempoPatioHoras * 10) / 10,
          horas_exceso: Math.round(horasExceso * 10) / 10,
          fecha_llegada: acceso.hora_llegada ? acceso.hora_llegada.split('T')[0] : '',
          fecha_salida: acceso.hora_salida ? acceso.hora_salida.split('T')[0] : '',
          hora_llegada_str: acceso.hora_llegada ? new Date(acceso.hora_llegada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
          hora_salida_str: acceso.hora_salida ? new Date(acceso.hora_salida).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
          fecha_corta: acceso.hora_llegada ? acceso.hora_llegada.split('-').reverse().slice(0, 2).join('/') : '--/--',
          raw_date: new Date(acceso.hora_llegada)
        };
      });

      setMetricas(dataProcesada);
    } catch (err) {
      console.error("Falla en Auditoría de Flota:", err);
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
      .channel('cambios-auditoria-flota')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flota_accesos' }, () => {
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
      const score = Number(m.efectividad_carga);
      if (filtroEficiencia === 'bajo') return score < umbral;
      if (filtroEficiencia === 'medio') return score >= umbral && score <= 85;
      if (filtroEficiencia === 'alto') return score > 85;
      return true;
    });
  }, [dataFiltradaTemp, filtroEficiencia, umbralEfectividad]);

  const dataIndividual = useMemo(() => {
    if (!busquedaPerfil) return [];
    return [...dataFiltrada].filter(m => 
      m.nombre_perfil.toLowerCase().includes(busquedaPerfil.toLowerCase()) ||
      m.doc_perfil.includes(busquedaPerfil)
    ).reverse();
  }, [dataFiltrada, busquedaPerfil]);

  // FLOTAS CON DIFERENCIA
  const flotasConDiferencia = useMemo(() => {
    const resumen: Record<string, any> = {};
    dataFiltrada.forEach(m => {
      if (!m.nombre_perfil || m.nombre_perfil === 'SISTEMA') return;
      if (!resumen[m.nombre_perfil]) {
        resumen[m.nombre_perfil] = {
          nombre: m.nombre_perfil,
          doc: m.doc_perfil,
          flota: m.flota_nombre,
          total_rutas: 0,
          total_carga: 0,
          diferencia: 0,
          porcentaje_cumplimiento: 0,
          accesos: []
        };
      }
      resumen[m.nombre_perfil].total_rutas += m.rutas_asignadas || 0;
      resumen[m.nombre_perfil].total_carga += m.carga_real || 0;
      resumen[m.nombre_perfil].accesos.push(m);
    });
    
    Object.keys(resumen).forEach(key => {
      const item = resumen[key];
      item.diferencia = item.total_rutas - item.total_carga;
      item.porcentaje_cumplimiento = item.total_rutas > 0 
        ? Math.round((item.total_carga / item.total_rutas) * 100) 
        : 0;
    });
    
    return Object.values(resumen).sort((a, b) => b.diferencia - a.diferencia);
  }, [dataFiltrada]);

  // RANKING TIEMPO CARGA
  const rankingTiempoCarga = useMemo(() => {
    const tiempos: Record<string, any> = {};
    dataFiltrada.forEach(m => {
      if (!m.nombre_perfil || m.nombre_perfil === 'SISTEMA' || !m.tiempo_patio_horas) return;
      if (!tiempos[m.nombre_perfil]) {
        tiempos[m.nombre_perfil] = {
          nombre: m.nombre_perfil,
          doc: m.doc_perfil,
          flota: m.flota_nombre,
          total_tiempo: 0,
          promedio_tiempo: 0,
          cantidad_accesos: 0
        };
      }
      tiempos[m.nombre_perfil].total_tiempo += m.tiempo_patio_horas;
      tiempos[m.nombre_perfil].cantidad_accesos += 1;
    });
    
    Object.keys(tiempos).forEach(key => {
      const item = tiempos[key];
      item.promedio_tiempo = item.cantidad_accesos > 0 
        ? Math.round((item.total_tiempo / item.cantidad_accesos) * 10) / 10
        : 0;
    });
    
    return Object.values(tiempos).sort((a, b) => a.promedio_tiempo - b.promedio_tiempo);
  }, [dataFiltrada]);

  // RANKING OBSERVACIONES
  const rankingObservaciones = useMemo(() => {
    const observaciones: Record<string, any> = {};
    dataFiltrada.forEach(m => {
      if (!m.nombre_perfil || m.nombre_perfil === 'SISTEMA' || !m.observacion) return;
      if (!observaciones[m.nombre_perfil]) {
        observaciones[m.nombre_perfil] = {
          nombre: m.nombre_perfil,
          doc: m.doc_perfil,
          flota: m.flota_nombre,
          total_obs: 0,
          obs_list: []
        };
      }
      observaciones[m.nombre_perfil].total_obs += 1;
      observaciones[m.nombre_perfil].obs_list.push(m.observacion);
    });
    return Object.values(observaciones).sort((a, b) => b.total_obs - a.total_obs);
  }, [dataFiltrada]);

  // DATOS EFECTIVIDAD REPARTO
  const datosEfectividadReparto = useMemo(() => {
    let totalRutas = 0;
    let totalCarga = 0;
    dataFiltrada.forEach(m => {
      totalRutas += m.rutas_asignadas || 0;
      totalCarga += m.carga_real || 0;
    });
    const cargaRealizada = totalCarga;
    const cargaPendiente = Math.max(0, totalRutas - totalCarga);
    return [
      { name: 'Carga Realizada', value: cargaRealizada, color: '#10b981' },
      { name: 'Carga Pendiente', value: cargaPendiente, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [dataFiltrada]);

  // EFECTIVIDAD POR FLOTA
  const efectividadPorFlota = useMemo(() => {
    const flotas: Record<string, any> = {};
    dataFiltrada.forEach(m => {
      if (!m.flota_nombre || m.flota_nombre === '') return;
      if (!flotas[m.flota_nombre]) {
        flotas[m.flota_nombre] = {
          nombre: m.flota_nombre,
          rutas: 0,
          carga: 0,
          diferencia: 0
        };
      }
      flotas[m.flota_nombre].rutas += m.rutas_asignadas || 0;
      flotas[m.flota_nombre].carga += m.carga_real || 0;
    });
    Object.keys(flotas).forEach(key => {
      flotas[key].diferencia = flotas[key].rutas - flotas[key].carga;
    });
    return Object.values(flotas).filter(f => f.rutas > 0);
  }, [dataFiltrada]);

  // INSIGHTS IA
  const insightsIA = useMemo(() => {
    const hallazgos: any[] = [];
    flotasConDiferencia.forEach(flota => {
      if (flota.porcentaje_cumplimiento < umbralEfectividad) {
        hallazgos.push({
          id: `efectividad-${flota.doc}`,
          titulo: `Baja Efectividad: ${flota.nombre}`,
          desc: `Cumplió solo el ${flota.porcentaje_cumplimiento}% de las rutas. Le faltaron ${flota.diferencia} unidades.`,
          solucion: 'Revisar planificación de carga o capacidad del vehículo.',
          nivel: flota.porcentaje_cumplimiento < 50 ? 'CRÍTICO' : 'ALERTA'
        });
      }
    });
    
    rankingTiempoCarga.forEach(conductor => {
      if (conductor.promedio_tiempo > 6) {
        hallazgos.push({
          id: `tiempo-${conductor.doc}`,
          titulo: `Tiempo Excesivo: ${conductor.nombre}`,
          desc: `Promedia ${conductor.promedio_tiempo}h por acceso.`,
          solucion: 'Revisar demoras en carga/descarga.',
          nivel: conductor.promedio_tiempo > 8 ? 'CRÍTICO' : 'ALERTA'
        });
      }
    });
    
    rankingObservaciones.slice(0, 3).forEach(obs => {
      if (obs.total_obs >= 3) {
        hallazgos.push({
          id: `obs-${obs.doc}`,
          titulo: `Múltiples Observaciones: ${obs.nombre}`,
          desc: `Tiene ${obs.total_obs} observaciones.`,
          solucion: 'Revisar detalle de observaciones.',
          nivel: 'INFORMATIVO'
        });
      }
    });
    
    return hallazgos.filter(h => !checksValidados[h.id]);
  }, [flotasConDiferencia, rankingTiempoCarga, rankingObservaciones, checksValidados, umbralEfectividad]);

  // KPIS
  const kpis = useMemo(() => {
    const totalRutas = dataFiltrada.reduce((sum, m) => sum + (m.rutas_asignadas || 0), 0);
    const totalCarga = dataFiltrada.reduce((sum, m) => sum + (m.carga_real || 0), 0);
    const diferencia = totalRutas - totalCarga;
    const efectividadProm = dataFiltrada.length > 0 
      ? Math.round(dataFiltrada.reduce((sum, m) => sum + (m.efectividad_carga || 0), 0) / dataFiltrada.length) 
      : 0;
    
    return { totalRutas, totalCarga, diferencia, efectividadProm };
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

          <div className="flex gap-1 overflow-x-auto pb-1">
            {[
              { id: 'global', label: 'GLOBAL' }, 
              { id: 'atencion', label: 'ATENCIÓN IA', alert: insightsIA.length > 0 },
              { id: 'individual', label: 'POR PERFIL' },
              { id: 'efectividad', label: 'REPARTO', alert: datosEfectividadReparto.length > 0 }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setTabActiva(tab.id as any)} 
                className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${tabActiva === tab.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
              >
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
              {/* GLOBAL */}
              {tabActiva === 'global' && (
                <div className="flex flex-col h-full space-y-4 overflow-y-auto custom-scrollbar pr-2">
                  {/* KPIS */}
                  <div className="grid grid-cols-4 gap-3 shrink-0">
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase">TOTAL RUTAS</p>
                      <p className="text-2xl font-black text-white">{kpis.totalRutas}</p>
                    </div>
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-emerald-400 uppercase">CARGA REAL</p>
                      <p className="text-2xl font-black text-white">{kpis.totalCarga}</p>
                    </div>
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-amber-400 uppercase">DIFERENCIA</p>
                      <p className="text-2xl font-black text-white">{kpis.diferencia}</p>
                    </div>
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-[9px] font-black text-blue-400 uppercase">EFIC PROM</p>
                      <p className="text-2xl font-black text-white">{kpis.efectividadProm}%</p>
                    </div>
                  </div>

                  {/* FLOTAS CON CARGA INCOMPLETA */}
                  <div className="bg-[#0f172a] p-4 rounded-lg border border-white/5">
                    <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      CARGA INCOMPLETA
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="text-[9px] font-black text-slate-500 uppercase">
                          <tr>
                            <th className="pb-2">CONDUCTOR</th>
                            <th className="pb-2 text-center">RUTAS</th>
                            <th className="pb-2 text-center">CARGA</th>
                            <th className="pb-2 text-center">DIF</th>
                            <th className="pb-2 text-center">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {flotasConDiferencia.filter(f => f.diferencia > 0).slice(0, 5).map((flota, idx) => (
                            <tr key={idx} className="border-t border-white/5">
                              <td className="py-2">
                                <p className="text-[11px] font-black text-white">{flota.nombre}</p>
                                <p className="text-[8px] text-slate-500">{flota.flota}</p>
                              </td>
                              <td className="py-2 text-center font-mono text-[10px]">{flota.total_rutas}</td>
                              <td className="py-2 text-center font-mono text-emerald-400 text-[10px]">{flota.total_carga}</td>
                              <td className="py-2 text-center font-mono text-rose-400 text-[10px]">-{flota.diferencia}</td>
                              <td className="py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${flota.porcentaje_cumplimiento >= umbralEfectividad ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                  {flota.porcentaje_cumplimiento}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* RANKING TIEMPOS */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-white/5">
                      <h3 className="text-sm font-black text-white uppercase mb-3">⚡ MÁS RÁPIDOS</h3>
                      {rankingTiempoCarga.slice(0, 4).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-white/5 py-1.5">
                          <p className="text-[10px] font-black text-white">{item.nombre}</p>
                          <p className="text-emerald-400 font-black text-[10px]">{item.promedio_tiempo}h</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-white/5">
                      <h3 className="text-sm font-black text-white uppercase mb-3">🐢 MÁS LENTOS</h3>
                      {[...rankingTiempoCarga].reverse().slice(0, 4).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-white/5 py-1.5">
                          <p className="text-[10px] font-black text-white">{item.nombre}</p>
                          <p className="text-rose-400 font-black text-[10px]">{item.promedio_tiempo}h</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ATENCIÓN IA */}
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
                              <span className={`text-[9px] font-black px-3 py-1 rounded-full ${h.nivel === 'CRÍTICO' ? 'bg-rose-600' : h.nivel === 'ALERTA' ? 'bg-amber-600' : 'bg-blue-600'} text-white`}>{h.nivel}</span>
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

              {/* POR PERFIL */}
              {tabActiva === 'individual' && (
                <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                  <div className="bg-[#0f172a] p-4 rounded-lg border border-white/5 mb-4">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="BUSCAR PERFIL..." 
                        value={busquedaPerfil} 
                        onChange={(e) => setBusquedaPerfil(e.target.value)} 
                        className="w-full bg-black/40 border border-white/10 p-3 pr-10 rounded-lg text-white font-black text-base outline-none focus:border-blue-500"
                      />
                      {busquedaPerfil && (
                        <button onClick={() => setBusquedaPerfil('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white text-sm">✕</button>
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
                              <Area type="monotone" dataKey="efectividad_carga" stroke="#3b82f6" fill="url(#colorScore)" strokeWidth={2} name="Efectividad %" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex justify-center">
                          <div className="bg-black/60 px-6 py-3 rounded-lg border border-blue-500/20 text-center">
                            <p className="text-lg font-black text-white uppercase">{dataIndividual[0].nombre_perfil}</p>
                            <p className="text-[11px] font-black text-blue-500 mt-1">DOC: {dataIndividual[0].doc_perfil} • FLOTA: {dataIndividual[0].flota_nombre}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* EFECTIVIDAD DE REPARTO */}
              {tabActiva === 'efectividad' && (
                <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* GRÁFICO DE TORTA */}
                    <div className="bg-[#0f172a] p-5 rounded-lg border border-white/5">
                      <h3 className="text-sm font-black text-white uppercase mb-4 text-center">EFECTIVIDAD GLOBAL</h3>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={datosEfectividadReparto}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {datosEfectividadReparto.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} unidades`, 'Cantidad']} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* EFECTIVIDAD POR FLOTA */}
                    <div className="bg-[#0f172a] p-5 rounded-lg border border-white/5">
                      <h3 className="text-sm font-black text-white uppercase mb-4 text-center">EFECTIVIDAD POR FLOTA</h3>
                      <div className="space-y-3">
                        {efectividadPorFlota.slice(0, 6).map((flota, idx) => {
                          const porcentaje = flota.rutas > 0 ? Math.round((flota.carga / flota.rutas) * 100) : 0;
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between items-center text-[10px]">
                                <p className="text-white font-black">{flota.nombre}</p>
                                <p className="text-slate-400">{flota.carga}/{flota.rutas} ({porcentaje}%)</p>
                              </div>
                              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${porcentaje >= umbralEfectividad ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${porcentaje}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
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