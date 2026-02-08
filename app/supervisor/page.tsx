'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// --- FÓRMULA DE HAVERSINE PARA GEOLOCALIZACIÓN ---
function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; // Radio de la tierra en metros
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SupervisorPage() {
  const [user, setUser] = useState<any>(null);
  const [gps, setGps] = useState({ lat: 0, lon: 0 });
  const [config, setConfig] = useState({ lat: 0, lon: 0, radio: 100, qr_exp: 30000 });
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [modo, setModo] = useState<'qr' | 'manual'>('qr');
  
  // Estados de lectura y buffer
  const [qrData, setQrData] = useState<string | null>(null);
  const [pinEmpleado, setPinEmpleado] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState('');
  const [lecturaLista, setLecturaLista] = useState(false);
  const [animar, setAnimar] = useState(false);
  
  // Estado de alerta GPS solicitado
  const [mensajeGPS, setMensajeGPS] = useState<{ texto: string; visible: boolean } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  // --- CARGA DE CONFIGURACIÓN Y GPS ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));

    const loadConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const m = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          lat: parseFloat(m.almacen_lat) || 0,
          lon: parseFloat(m.almacen_lon) || 0,
          radio: parseInt(m.radio_maximo) || 100,
          qr_exp: parseInt(m.timer_token) || 60000
        });
      }
    };
    loadConfig();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => console.error("Error GPS:", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  // --- LÓGICA DE ALERTA Y REINICIO ---
  const mostrarAlertaGPS = (metros: number) => {
    setMensajeGPS({ texto: `Supervisor fuera de rango: (${Math.round(metros)}m)`, visible: true });
    
    // Bloqueo y limpieza de buffer por 2 segundos
    setTimeout(() => {
      setMensajeGPS(null);
      setDireccion(null);
      resetLectura();
    }, 2000);
  };

  const resetLectura = useCallback(() => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    setQrData(null);
    setPinEmpleado('');
    setPinAutorizador('');
    setLecturaLista(false);
    setModo('qr');
  }, []);

  // --- VALIDACIÓN DE ENTRADA AL MÓDULO ---
  const intentarEntrarQR = (dir: 'entrada' | 'salida') => {
    const distancia = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
    if (distancia > config.radio) {
      mostrarAlertaGPS(distancia);
      return;
    }
    setDireccion(dir);
  };

  // --- PROCESO DE REGISTRO CON DOBLE VALIDACIÓN GPS ---
  const registrarAcceso = async () => {
    const distanciaFinal = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
    if (distanciaFinal > config.radio) {
      mostrarAlertaGPS(distanciaFinal);
      return;
    }

    if (!qrData || !pinAutorizador) return;
    setAnimar(true);

    try {
      // 1. Validar PIN del Supervisor (Autorizador)
      const { data: sup } = await supabase.from('empleados')
        .select('id')
        .eq('documento_id', user.documento_id)
        .eq('pin', pinAutorizador)
        .single();

      if (!sup) throw new Error("PIN SUPERVISOR INCORRECTO");

      // 2. Procesar QR (Extracción de ID y Timestamp)
      const [empId, timestamp] = qrData.split('|');
      const tiempoQR = parseInt(timestamp);
      
      if (Date.now() - tiempoQR > config.qr_exp) throw new Error("TOKEN QR EXPIRADO");

      // 3. Registrar en base de datos
      const { error } = await supabase.rpc('registrar_jornada_v2', {
        p_empleado_id: empId,
        p_supervisor_id: user.id,
        p_tipo: direccion,
        p_lat: gps.lat,
        p_lon: gps.lon
      });

      if (error) throw error;

      alert("REGISTRO EXITOSO");
      setDireccion(null);
      resetLectura();
    } catch (err: any) {
      alert(err.message || "ERROR EN REGISTRO");
    } finally {
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white p-4 font-sans">
      
      {/* EMERGENTE ÁMBAR SOLICITADO */}
      {mensajeGPS?.visible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-amber-500 text-black px-10 py-12 rounded-[40px] border-4 border-white shadow-[0_0_60px_rgba(245,158,11,0.6)] animate-in zoom-in duration-200">
            <p className="text-2xl font-black uppercase text-center italic leading-tight">
              {mensajeGPS.texto}
            </p>
            <div className="mt-4 h-1 bg-black/20 w-full overflow-hidden">
              <div className="h-full bg-black animate-[progress_2s_linear]"></div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto pt-6">
        <header className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
          <div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Módulo de Control</p>
            <h1 className="text-xl font-black italic">SUPERVISOR</h1>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-500 uppercase">{user?.nombre}</p>
            <p className={`text-[9px] font-black ${calcularDistancia(gps.lat, gps.lon, config.lat, config.lon) <= config.radio ? 'text-emerald-500' : 'text-rose-500'}`}>
              GPS ACTIVO
            </p>
          </div>
        </header>

        {!direccion ? (
          <div className="grid gap-4">
            <button 
              onClick={() => intentarEntrarQR('entrada')}
              className="bg-emerald-600 hover:bg-emerald-500 p-10 rounded-[35px] shadow-xl transition-all active:scale-95 group"
            >
              <span className="block text-[10px] font-black text-emerald-200 mb-1 opacity-60">AUDITORÍA</span>
              <span className="text-3xl font-black italic uppercase tracking-tighter">Registrar Entrada</span>
            </button>

            <button 
              onClick={() => intentarEntrarQR('salida')}
              className="bg-rose-600 hover:bg-rose-500 p-10 rounded-[35px] shadow-xl transition-all active:scale-95"
            >
              <span className="block text-[10px] font-black text-rose-200 mb-1 opacity-60">AUDITORÍA</span>
              <span className="text-3xl font-black italic uppercase tracking-tighter">Registrar Salida</span>
            </button>

            <button onClick={() => router.push('/reportes')} className="mt-6 text-slate-500 font-black text-[10px] uppercase tracking-[0.3em]">← Volver al Panel</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#0f172a] p-6 rounded-[35px] border border-white/10 relative overflow-hidden">
               <div id="reader" className="rounded-2xl overflow-hidden bg-black aspect-square"></div>
               {modo === 'qr' && !qrData && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-blue-500/50 rounded-3xl animate-pulse"></div>
                 </div>
               )}
            </div>

            <div className="space-y-3">
              <input 
                type="password" 
                placeholder="PIN SUPERVISOR" 
                value={pinAutorizador}
                onChange={e => setPinAutorizador(e.target.value)}
                className="w-full bg-[#020617] border-2 border-blue-600 p-5 rounded-2xl text-center text-2xl font-black text-white outline-none focus:shadow-[0_0_15px_rgba(37,99,235,0.3)]"
              />
              
              <button 
                onClick={registrarAcceso}
                disabled={animar}
                className="w-full bg-blue-600 p-6 rounded-[25px] font-black text-xl italic uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
              >
                {animar ? 'PROCESANDO...' : 'CONFIRMAR REGISTRO'}
              </button>

              <button 
                onClick={() => { setDireccion(null); resetLectura(); }}
                className="w-full text-center py-2 text-slate-500 font-bold uppercase text-[10px] tracking-widest"
              >
                ← CANCELAR OPERACIÓN
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes progress { from { width: 100%; } to { width: 0%; } }
        #reader video { border-radius: 20px !important; object-fit: cover !important; }
      `}</style>
    </main>
  );
}