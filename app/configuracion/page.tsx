'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import GPSDiagnostic from '../components/GPSDiagnostic';

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#020617] flex items-center justify-center text-blue-500 font-black italic uppercase tracking-widest animate-pulse">
      Sincronizando Mapa...
    </div>
  ),
});

const formatearRol = (rol: string): string => {
  if (!rol) return 'USUARIO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin':
    case 'administrador':
      return 'ADMINISTRADOR';
    case 'supervisor':
      return 'SUPERVISOR';
    case 'tecnico':
      return 'TÉCNICO';
    case 'empleado':
      return 'EMPLEADO';
    default:
      return rol.toUpperCase();
  }
};

const MemebreteSuperior = ({ usuario }: { usuario?: any }) => {
  const titulo = 'CONFIGURACIÓN MAESTRA';
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 text-center shadow-2xl mx-auto">
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{primerasPalabras} </span>
        <span className="text-blue-700">{ultimaPalabra}</span>
      </h1>
      {usuario && (
        <div className="mt-2">
          <span className="text-sm text-white normal-case">{usuario.nombre}</span>
          <span className="text-sm text-white mx-2">•</span>
          <span className="text-sm text-blue-500 normal-case">{formatearRol(usuario.rol)}</span>
          <span className="text-sm text-white ml-2">({usuario.nivel_acceso})</span>
        </div>
      )}
    </div>
  );
};

export default function ConfigMaestraPage() {
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tabActual, setTabActual] = useState('geolocalizacion');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({
    texto: '',
    tipo: null,
  });
  const [estadisticasRespondIO, setEstadisticasRespondIO] = useState({ total: 0, conTelefono: 0, sincronizados: 0 });

  // Estado del módulo de limpieza
  const [limpieza, setLimpieza] = useState<Record<string, {
    modo: 'dias' | 'rango';
    dias: number;
    desde: string;
    hasta: string;
    preview: number | null;
    cargando: boolean;
    confirmText: string;
    modalAbierto: boolean;
  }>>({
    jornadas: { modo: 'dias', dias: 90, desde: '', hasta: '', preview: null, cargando: false, confirmText: '', modalAbierto: false },
    flota_accesos: { modo: 'dias', dias: 180, desde: '', hasta: '', preview: null, cargando: false, confirmText: '', modalAbierto: false },
    auditoria_flota: { modo: 'dias', dias: 180, desde: '', hasta: '', preview: null, cargando: false, confirmText: '', modalAbierto: false },
    telegram_mensajes: { modo: 'dias', dias: 60, desde: '', hasta: '', preview: null, cargando: false, confirmText: '', modalAbierto: false },
    whatsapp_mensajes: { modo: 'dias', dias: 60, desde: '', hasta: '', preview: null, cargando: false, confirmText: '', modalAbierto: false },
    programaciones: { modo: 'dias', dias: 30, desde: '', hasta: '', preview: null, cargando: false, confirmText: '', modalAbierto: false },
  });

  const router = useRouter();


  const rango100 = Array.from({ length: 100 }, (_, i) => i + 1);
  const rango24 = Array.from({ length: 24 }, (_, i) => i + 1);
  const rango60 = Array.from({ length: 60 }, (_, i) => i + 1);
  const rango100Porcentaje = Array.from({ length: 101 }, (_, i) => i);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    setUser(JSON.parse(sessionData));
    fetchConfig();
    fetchEstadisticasRespondIO();
  }, [router]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).from('sistema_config').select('clave, valor');
      if (error) throw error;

      if (data) {
        const cfgMap = (data as any[]).reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});

        setConfig({
          almacen_lat: cfgMap.almacen_lat || cfgMap.gps_latitud || '0',
          almacen_lon: cfgMap.almacen_lon || cfgMap.gps_longitud || '0',
          radio_maximo: cfgMap.radio_maximo || '100',
          timer_token: cfgMap.timer_token || '60000',
          timer_inactividad: cfgMap.timer_inactividad || '300000',
          empresa_nombre: cfgMap.empresa_nombre || 'SISTEMA',
          maximo_labor: cfgMap.maximo_labor || '28800000',
          porcentaje_efectividad: cfgMap.porcentaje_efectividad || '70',
        });
      }
    } catch (err) {
      showNotification('ERROR CRÍTICO DE SINCRONIZACIÓN', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEstadisticasRespondIO = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('empleados')
        .select('telefono, respondio_sincronizado');

      if (error) throw error;

      if (data) {
        // ✅ TIPAR EXPLÍCITAMENTE EL ARRAY
        const empleadosData = data as { telefono: string | null; respondio_sincronizado: boolean }[];

        setEstadisticasRespondIO({
          total: empleadosData.length,
          conTelefono: empleadosData.filter(e => e.telefono).length,
          sincronizados: empleadosData.filter(e => e.respondio_sincronizado).length
        });
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 4000);
  };

  const msAMinutos = (ms: string) => Math.floor(parseInt(ms || '0') / 60000).toString();
  const minutosAMs = (min: string) => (parseInt(min || '0') * 60000).toString();
  const msAHoras = (ms: string) => Math.floor(parseInt(ms || '0') / 3600000).toString();
  const horasAMs = (hrs: string) => (parseInt(hrs || '0') * 3600000).toString();

  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      const updates = claves.map((clave) => ({
        clave,
        valor: config[clave]?.toString() || '',
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await (supabase as any)
          .from('sistema_config')
          .upsert(update, { onConflict: 'clave' });

        if (error) throw error;
      }

      showNotification(`DATOS ACTUALIZADOS: ${tabActual.toUpperCase()}`, 'success');
    } catch (err) {
      showNotification('FALLO AL ACTUALIZAR REGISTROS', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardar = () => {
    const m: any = {
      geolocalizacion: ['almacen_lat', 'almacen_lon', 'radio_maximo'],
      seguridad: ['timer_token', 'timer_inactividad'],
      laboral: ['maximo_labor'],
      interfaz: ['empresa_nombre'],
      efectividad: ['porcentaje_efectividad'],
    };
    guardarModulo(m[tabActual]);
  };

  const getAuthH = (): Record<string, string> => {
    const s = localStorage.getItem('user_session');
    if (!s) return {};
    const u = JSON.parse(s);
    return { 'x-user-id': u.id ?? '', 'x-user-pin': u.pin_seguridad ?? '' };
  };

  const setL = (tabla: string, patch: any) =>
    setLimpieza(prev => ({ ...prev, [tabla]: { ...prev[tabla], ...patch } }));

  const previsualizarLimpieza = async (tabla: string) => {
    const st = limpieza[tabla];
    setL(tabla, { cargando: true, preview: null });
    const body: any = { tabla, accion: 'preview' };
    if (st.modo === 'dias') body.dias = st.dias;
    else { body.desde = st.desde || undefined; body.hasta = st.hasta; }
    const res = await fetch('/api/admin/limpieza', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthH() }, body: JSON.stringify(body) });
    const data = await res.json();
    setL(tabla, { cargando: false, preview: res.ok ? data.count : null, modalAbierto: res.ok });
    if (!res.ok) showNotification(data.error || 'Error al calcular', 'error');
  };

  const ejecutarLimpieza = async (tabla: string) => {
    const st = limpieza[tabla];
    if (st.confirmText !== 'ELIMINAR') return;
    setL(tabla, { cargando: true });
    const body: any = { tabla, accion: 'delete' };
    if (st.modo === 'dias') body.dias = st.dias;
    else { body.desde = st.desde || undefined; body.hasta = st.hasta; }
    const res = await fetch('/api/admin/limpieza', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthH() }, body: JSON.stringify(body) });
    const data = await res.json();
    setL(tabla, { cargando: false, preview: null, modalAbierto: false, confirmText: '' });
    if (res.ok) showNotification(`✅ ${data.eliminados} registros eliminados de ${data.label}`, 'success');
    else showNotification(data.error || 'Error al eliminar', 'error');
  };

  if (loading || !config)
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black italic tracking-widest animate-pulse">
        CONFIGURACIÓN MAESTRA...
      </div>
    );

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        {mensaje.tipo && (
          <div
            className={`fixed top-10 right-1/2 translate-x-1/2 z-[5000] px-10 py-5 rounded-[25px] border-2 shadow-2xl animate-in slide-in-from-top-10 duration-500 ${mensaje.tipo === 'success'
              ? 'bg-blue-600/90 border-blue-400 text-white'
              : 'bg-rose-600/90 border-rose-400 text-white'
              }`}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-[12px] font-black uppercase tracking-[0.4em] italic">Confirmación de Sistema</span>
              <span className="text-[14px] font-bold uppercase">{mensaje.texto}</span>
            </div>
          </div>
        )}

        <div className="relative w-full mb-10">
          <MemebreteSuperior usuario={user} />
          <div className="absolute top-0 right-0 flex gap-3 mt-6 mr-6">
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {guardando ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
            </button>
            <button
              onClick={() => router.back()}
              className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
            >
              REGRESAR
            </button>
          </div>
        </div>

        <div>
          {/* ── TABS HORIZONTALES ───────────────────────────────────── */}
          <div className="flex gap-3 overflow-x-auto pb-4 mb-6" style={{ scrollbarWidth: 'none' }}>
            {[
              { id: 'geolocalizacion', emoji: '📍', label: 'GEOCERCA\nGPS', active: 'bg-emerald-700 shadow-emerald-900/50' },
              { id: 'seguridad', emoji: '🛡️', label: 'PARÁMETROS\nTIEMPO', active: 'bg-blue-600 shadow-blue-900/50' },
              { id: 'laboral', emoji: '⏱️', label: 'JORNADA\nLABORAL', active: 'bg-slate-600 shadow-slate-900/50' },
              { id: 'efectividad', emoji: '📊', label: 'PORCENTAJE\nEFECTIVIDAD', active: 'bg-amber-600 shadow-amber-900/50' },
              { id: 'interfaz', emoji: '🖥️', label: 'INTERFAZ\nSISTEMA', active: 'bg-violet-600 shadow-violet-900/50' },
              { id: 'respondio', emoji: '🔄', label: 'RESPOND\nIO', active: 'bg-indigo-600 shadow-indigo-900/50' },
              ...(user?.nivel_acceso >= 8 ? [{ id: 'limpieza', emoji: '🧹', label: 'LIMPIEZA\nDATOS', active: 'bg-rose-700 shadow-rose-900/50' }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-2 px-6 py-4 rounded-[22px] transition-all duration-300 shadow-lg ${tabActual === tab.id
                    ? tab.active + ' text-white scale-105 shadow-xl'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
              >
                <span className="text-2xl leading-none">{tab.emoji}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight whitespace-pre-line">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          <div className="bg-[#0f172a] rounded-[40px] border border-white/5 p-7 md:p-10 shadow-2xl">
            <div className="space-y-8">
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#020617] p-5 rounded-[22px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Radio (m):</p>
                      <select
                        value={config.radio_maximo}
                        onChange={(e) => setConfig({ ...config, radio_maximo: e.target.value })}
                        className="bg-transparent text-3xl font-black text-white w-full outline-none cursor-pointer"
                      >
                        {rango100.map((v) => (
                          <option key={v} value={v} className="bg-[#0f172a]">{v} m</option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-[#020617] p-5 rounded-[22px] border border-blue-500/20">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Latitud:</p>
                      <p className="text-base font-mono text-blue-400 font-bold truncate">{config.almacen_lat || '—'}</p>
                      <p className="text-[8px] text-slate-600 mt-1">↓ Haz clic en el mapa</p>
                    </div>
                    <div className="bg-[#020617] p-5 rounded-[22px] border border-emerald-500/20">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Longitud:</p>
                      <p className="text-base font-mono text-emerald-400 font-bold truncate">{config.almacen_lon || '—'}</p>
                      <p className="text-[8px] text-slate-600 mt-1">↓ Haz clic en el mapa</p>
                    </div>
                  </div>

                  <div className="rounded-[30px] overflow-hidden border border-white/10 h-[200px] mb-3">
                    <MapaInteractivo
                      lat={config.almacen_lat}
                      lng={config.almacen_lon}
                      onLocationChange={(lat: number, lng: number) =>
                        setConfig({ ...config, almacen_lat: lat.toString(), almacen_lon: lng.toString() })
                      }
                    />
                  </div>

                  <GPSDiagnostic />
                </div>
              )}

              {tabActual === 'seguridad' && (
                <div className="space-y-6">
                  <div className="bg-[#020617] p-8 rounded-[40px] border border-white/5">
                    <p className="text-[12px] font-black text-blue-500 uppercase block mb-4 tracking-widest">
                      Expiración Token QR (Minutos):
                    </p>
                    <select
                      value={msAMinutos(config.timer_token)}
                      onChange={(e) => setConfig({ ...config, timer_token: minutosAMs(e.target.value) })}
                      className="bg-transparent text-5xl font-black text-white w-full outline-none cursor-pointer"
                    >
                      {rango60.map((v) => (
                        <option key={v} value={v} className="bg-[#0f172a]">
                          {v} MIN
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-[#020617] p-8 rounded-[40px] border border-white/5">
                    <p className="text-[12px] font-black text-blue-500 uppercase block mb-4 tracking-widest">
                      Timeout Inactividad (Minutos):
                    </p>
                    <select
                      value={msAMinutos(config.timer_inactividad)}
                      onChange={(e) => setConfig({ ...config, timer_inactividad: minutosAMs(e.target.value) })}
                      className="bg-transparent text-5xl font-black text-white w-full outline-none cursor-pointer"
                    >
                      {rango60.map((v) => (
                        <option key={v} value={v} className="bg-[#0f172a]">
                          {v} MIN
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {tabActual === 'laboral' && (
                <div className="space-y-8">
                  <div className="bg-[#020617] p-12 rounded-[45px] border border-white/5 text-center">
                    <p className="text-[12px] font-black text-slate-500 uppercase mb-8 tracking-[0.4em]">
                      Tope Máximo de Jornada LABORAL:
                    </p>
                    <div className="flex items-center justify-center gap-6">
                      <select
                        value={msAHoras(config.maximo_labor)}
                        onChange={(e) => setConfig({ ...config, maximo_labor: horasAMs(e.target.value) })}
                        className="bg-transparent text-8xl font-black text-blue-500 outline-none text-center italic"
                      >
                        {rango24.map((v) => (
                          <option key={v} value={v} className="bg-[#0f172a]">
                            {v}
                          </option>
                        ))}
                      </select>
                      <span className="text-3xl font-black text-slate-800 uppercase italic">HRS</span>
                    </div>
                  </div>
                  <div className="bg-amber-500/5 p-8 rounded-[30px] border border-amber-500/20 text-center">
                    <p className="text-[12px] font-bold text-amber-500 uppercase leading-relaxed italic animate-pulse">
                      "El tiempo seleccionado servirá para dar alertas en los temporizadores del sistema y reportes
                      indicando que están llegando al tope de las horas laborables fijadas acá"
                    </p>
                  </div>
                </div>
              )}

              {tabActual === 'efectividad' && (
                <div className="space-y-8">
                  <div className="bg-[#020617] p-12 rounded-[45px] border border-white/5 text-center">
                    <p className="text-[12px] font-black text-slate-500 uppercase mb-8 tracking-[0.4em]">
                      PORCENTAJE MÍNIMO DE EFECTIVIDAD:
                    </p>
                    <div className="flex items-center justify-center gap-6">
                      <select
                        value={config.porcentaje_efectividad}
                        onChange={(e) => setConfig({ ...config, porcentaje_efectividad: e.target.value })}
                        className="bg-transparent text-8xl font-black text-blue-500 outline-none text-center italic"
                      >
                        {rango100Porcentaje.map((v) => (
                          <option key={v} value={v} className="bg-[#0f172a]">
                            {v}
                          </option>
                        ))}
                      </select>
                      <span className="text-3xl font-black text-slate-800 uppercase italic">%</span>
                    </div>
                  </div>
                  <div className="bg-blue-500/5 p-8 rounded-[30px] border border-blue-500/20 text-center">
                    <p className="text-[12px] font-bold text-blue-500 uppercase leading-relaxed italic animate-pulse">
                      "Este valor determina el umbral de eficiencia en los módulos de auditoría.
                      Los registros por debajo de este porcentaje se consideran de BAJA EFECTIVIDAD
                      y aparecerán en la sección de Atención IA"
                    </p>
                  </div>
                </div>
              )}

              {tabActual === 'interfaz' && (
                <div className="bg-[#020617] p-10 rounded-[40px] border border-white/5">
                  <p className="text-[12px] font-black text-blue-500 uppercase block mb-4 tracking-widest">
                    Identidad del Sistema:
                  </p>
                  <input
                    type="text"
                    value={config.empresa_nombre || ''}
                    onChange={(e) => setConfig({ ...config, empresa_nombre: e.target.value })}
                    className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic border-b border-white/10 pb-4 focus:border-blue-500 transition-colors"
                  />
                </div>
              )}

              {tabActual === 'respondio' && (
                <div className="space-y-6">
                  <div className="bg-[#020617] p-8 rounded-[40px] border border-white/5">
                    <h2 className="text-xl font-black text-blue-500 mb-6">🔄 SINCRONIZACIÓN CON RESPOND.IO</h2>

                    <div className="grid grid-cols-3 gap-6 mb-8">
                      <div className="bg-black/30 p-6 rounded-xl">
                        <p className="text-slate-400 text-sm mb-2">Total Empleados</p>
                        <p className="text-3xl font-bold">{estadisticasRespondIO.total}</p>
                      </div>
                      <div className="bg-black/30 p-6 rounded-xl">
                        <p className="text-slate-400 text-sm mb-2">Con Teléfono</p>
                        <p className="text-3xl font-bold text-emerald-400">{estadisticasRespondIO.conTelefono}</p>
                      </div>
                      <div className="bg-black/30 p-6 rounded-xl">
                        <p className="text-slate-400 text-sm mb-2">Sincronizados</p>
                        <p className="text-3xl font-bold text-blue-400">{estadisticasRespondIO.sincronizados}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm text-slate-400">
                        La sincronización masiva se realiza en una página dedicada para no saturar la configuración.
                        Los empleados se sincronizarán automáticamente al crear o editar sus datos.
                      </p>

                      <button
                        onClick={() => router.push('/admin/sincronizar-masiva')}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition-all"
                      >
                        🔄 IR A SINCRONIZACIÓN MASIVA
                      </button>

                      <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/30">
                        <p className="text-xs text-amber-400">
                          ⚠️ Esta herramienta es solo para migración inicial o resincronización manual.
                          Los empleados nuevos se sincronizan automáticamente al crearlos.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB LIMPIEZA ── */}
              {tabActual === 'limpieza' && Number(user?.nivel_acceso) >= 8 && (() => {
                const CARDS = [
                  { tabla: 'jornadas', emoji: '📋', label: 'Jornadas de empleados', desc: 'Fecha entrada/salida, GPS, duración de jornada' },
                  { tabla: 'flota_accesos', emoji: '🚛', label: 'Accesos de flota', desc: 'Hora llegada/salida, cantidad de carga registrada' },
                  { tabla: 'auditoria_flota', emoji: '📊', label: 'Auditoría de flota', desc: 'Horas en patio, exceso, eficiencia calculada (%)' },
                  { tabla: 'telegram_mensajes', emoji: '📱', label: 'Historial Telegram', desc: 'Textos enviados, destinatario, estado del envío' },
                  { tabla: 'whatsapp_mensajes', emoji: '💬', label: 'Historial WhatsApp', desc: 'Conversaciones, números, timestamps de mensajes' },
                  { tabla: 'programaciones', emoji: '⏰', label: 'Programaciones ejecutadas', desc: 'Solo las ejecutadas/con error — las pendientes se conservan' },
                ];

                return (
                  <div className="space-y-4">
                    <div className="bg-rose-900/20 border border-rose-500/30 rounded-2xl p-4 flex gap-3 items-start">
                      <span className="text-xl shrink-0">⚠️</span>
                      <p className="text-rose-300 text-xs font-bold uppercase tracking-wide leading-relaxed">
                        Las eliminaciones son permanentes e irreversibles. Los datos maestros (empleados, flota, configuración, vinculaciones Telegram) nunca se tocan.
                        El sistema aplica un mínimo de 180 días para proteger datos recientes.
                      </p>
                    </div>

                    {CARDS.map(({ tabla, emoji, label, desc }) => {
                      const st = limpieza[tabla];
                      const fechaMaxHasta = (() => {
                        const d = new Date(); d.setDate(d.getDate() - 180);
                        return d.toISOString().split('T')[0];
                      })();

                      return (
                        <div key={tabla} className="bg-[#020617] rounded-2xl border border-white/5 p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-base font-black text-white">{emoji} {label}</span>
                              <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                            </div>
                          </div>

                          {/* Selector modo */}
                          <div className="flex gap-2">
                            {(['dias', 'rango'] as const).map(m => (
                              <button key={m} onClick={() => setL(tabla, { modo: m, preview: null })}
                                className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border transition-all ${st.modo === m ? 'bg-blue-700 border-blue-500 text-white' : 'border-white/10 text-slate-500 hover:text-white'
                                  }`}>
                                {m === 'dias' ? '⚡ Período rápido' : '📅 Rango de fechas'}
                              </button>
                            ))}
                          </div>

                          {/* Modo días */}
                          {st.modo === 'dias' && (
                            <div className="flex gap-2 flex-wrap">
                              {[30, 60, 90, 180].map(d => (
                                <button key={d} onClick={() => setL(tabla, { dias: d, preview: null })}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${st.dias === d ? 'bg-slate-700 border-slate-400 text-white' : 'border-white/10 text-slate-500 hover:text-white'
                                    }`}>
                                  {d} días
                                </button>
                              ))}
                              <span className="text-slate-600 text-xs self-center">← registros anteriores a este período</span>
                            </div>
                          )}

                          {/* Modo rango */}
                          {st.modo === 'rango' && (
                            <div className="flex gap-3 flex-wrap items-center">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Desde (opcional)</label>
                                <input type="date" max={fechaMaxHasta}
                                  value={st.desde}
                                  onChange={e => setL(tabla, { desde: e.target.value, preview: null })}
                                  className="bg-[#0f172a] border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Hasta <span className="text-rose-400">(máx: {fechaMaxHasta})</span></label>
                                <input type="date" max={fechaMaxHasta}
                                  value={st.hasta}
                                  onChange={e => setL(tabla, { hasta: e.target.value, preview: null })}
                                  className="bg-[#0f172a] border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none"
                                />
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => previsualizarLimpieza(tabla)}
                            disabled={st.cargando || (st.modo === 'rango' && !st.hasta)}
                            className="text-xs font-bold px-4 py-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-40"
                          >
                            {st.cargando ? '⏳ Calculando...' : '🔍 Ver cuántos registros se eliminarían'}
                          </button>

                          {/* Modal confirmación */}
                          {st.modalAbierto && (
                            <div className="bg-rose-900/20 border border-rose-500/40 rounded-xl p-4 space-y-3">
                              <p className="text-rose-300 text-sm font-bold">
                                Se eliminarán permanentemente <span className="text-white text-lg">{st.preview ?? '?'}</span> registros de <span className="text-white">{label}</span>.
                              </p>
                              <p className="text-rose-400 text-xs">Esta acción no se puede deshacer. Escribe <strong>ELIMINAR</strong> para confirmar:</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="ELIMINAR"
                                  value={st.confirmText}
                                  onChange={e => setL(tabla, { confirmText: e.target.value.toUpperCase() })}
                                  className="flex-1 bg-black border border-rose-500/40 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-rose-400 font-mono uppercase"
                                />
                                <button
                                  onClick={() => ejecutarLimpieza(tabla)}
                                  disabled={st.confirmText !== 'ELIMINAR' || st.cargando}
                                  className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-black rounded-lg disabled:opacity-30 transition-all uppercase"
                                >
                                  {st.cargando ? '⏳' : '🗑️ Eliminar'}
                                </button>
                                <button onClick={() => setL(tabla, { modalAbierto: false, confirmText: '', preview: null })}
                                  className="px-3 py-2 border border-white/10 text-slate-400 text-xs rounded-lg hover:text-white transition-all">
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}