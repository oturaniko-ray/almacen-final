'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import GPSDiagnostic from '../components/GPSDiagnostic'; // ✅ 1 nivel arriba (ya estaba bien)

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#020617] flex items-center justify-center text-blue-500 font-black italic uppercase tracking-widest animate-pulse">
      Sincronizando Mapa...
    </div>
  ),
});

// Función para formatear rol
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

// ----- MEMBRETE SUPERIOR -----
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
  }, [router]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('sistema_config').select('clave, valor');
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

      // ✅ SOLUCIÓN DEFINITIVA: Usar (supabase as any) para toda la cadena
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

  if (loading || !config)
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black italic tracking-widest animate-pulse">
        CONFIGURACIÓN MAESTRA...
      </div>
    );

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* NOTIFICACIÓN EMERGENTE */}
        {mensaje.tipo && (
          <div
            className={`fixed top-10 right-1/2 translate-x-1/2 z-[5000] px-10 py-5 rounded-[25px] border-2 shadow-2xl animate-in slide-in-from-top-10 duration-500 ${
              mensaje.tipo === 'success'
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

        {/* HEADER CON MEMBRETE Y BOTONES */}
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Pestañas laterales */}
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📍 GEOCERCA GPS' },
              { id: 'seguridad', label: '🛡️ PARÁMETROS DE\nTIEMPO' },
              { id: 'laboral', label: '⏱️ TIEMPO MÁXIMO\nLABORABLE' },
              { id: 'efectividad', label: '📊 PORCENTAJE DE\nEFECTIVIDAD' },
              { id: 'interfaz', label: '🖥️ INTERFAZ' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`w-full text-left p-6 rounded-[25px] border transition-all duration-300 ${
                  tabActual === tab.id
                    ? 'bg-white/5 border-white/20 shadow-lg text-white'
                    : 'border-transparent text-slate-500 hover:text-white'
                }`}
              >
                <span className="text-[12px] font-black uppercase tracking-widest leading-relaxed whitespace-pre-line">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Área de configuración */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-8 md:p-12 shadow-2xl">
            <div className="space-y-8">
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#020617] p-6 rounded-[30px] border border-white/5">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">
                        Rango de Tolerancia (Metros):
                      </p>
                      <select
                        value={config.radio_maximo}
                        onChange={(e) => setConfig({ ...config, radio_maximo: e.target.value })}
                        className="bg-transparent text-3xl font-black text-white w-full outline-none cursor-pointer"
                      >
                        {rango100.map((v) => (
                          <option key={v} value={v} className="bg-[#0f172a]">
                            {v} m
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-[#020617] p-6 rounded-[30px] border border-white/5">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">
                        Ajuste de Ubicación:
                      </p>
                      <div className="space-y-1">
                        <p className="text-[11px] font-mono text-blue-500 leading-none truncate">
                          LAT: {config.almacen_lat}
                        </p>
                        <p className="text-[11px] font-mono text-emerald-500 leading-none truncate">
                          LON: {config.almacen_lon}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* MAPA INTERACTIVO */}
                  <div className="rounded-[35px] overflow-hidden border border-white/10 h-[350px] mb-4">
                    <MapaInteractivo
                      lat={config.almacen_lat}
                      lng={config.almacen_lon}
                      onLocationChange={(lat: number, lng: number) =>
                        setConfig({ ...config, almacen_lat: lat.toString(), almacen_lon: lng.toString() })
                      }
                    />
                  </div>

                  {/* DIAGNÓSTICO GPS */}
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
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}