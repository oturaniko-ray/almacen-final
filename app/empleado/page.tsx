'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [errorGps, setErrorGps] = useState('');
  const [distancia, setDistancia] = useState<number | null>(null);
  const [coordsActuales, setCoordsActuales] = useState({ lat: 0, lon: 0 }); // Estado para GPS Real
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  const [reintentos, setReintentos] = useState(0);
  
  const [config, setConfig] = useState<any>({ 
    timer_inactividad: '120000', 
    timer_token: '120000',
    almacen_lat: 0, 
    almacen_lon: 0,
    radio_maximo: 0 
  });

  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();
  const timerSalidaRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);
    fetchConfig();

    const canalRealtime = supabase.channel('empleado-global-sync');
    canalRealtime
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.email === currentUser.email && payload.payload.id !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => { localStorage.removeItem('user_session'); router.push('/'); }, 3000);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sistema_config' }, () => fetchConfig())
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalRealtime.send({ type: 'broadcast', event: 'nueva-sesion', payload: { id: sessionId.current, email: currentUser.email } });
        }
      });

    return () => { supabase.removeChannel(canalRealtime); };
  }, [router]);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig({
        timer_inactividad: cfgMap.timer_inactividad || '120000',
        timer_token: cfgMap.timer_token || '120000',
        almacen_lat: parseFloat(cfgMap.almacen_lat) || 0,
        almacen_lon: parseFloat(cfgMap.almacen_lon) || 0,
        radio_maximo: parseInt(cfgMap.radio_maximo) || 0
      });
    }
  };

  function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  useEffect(() => {
    if (!user || sesionDuplicada || config.almacen_lat === 0) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoordsActuales({ lat: latitude, lon: longitude });
        const d = calcularDistancia(latitude, longitude, config.almacen_lat, config.almacen_lon);
        const dEntera = Math.round(d);
        setDistancia(dEntera);
        
        if (dEntera <= config.radio_maximo) {
          setUbicacionOk(true);
          setErrorGps('');
          if (!token) {
            const nuevoToken = btoa(`${user.documento_id}|${Date.now()}`);
            setToken(nuevoToken);
            if (timerSalidaRef.current) clearTimeout(timerSalidaRef.current);
            timerSalidaRef.current = setTimeout(() => setToken(''), parseInt(config.timer_token)); 
          }
        } else {
          setUbicacionOk(false);
          setToken('');
          setErrorGps(`Fuera de rango: ${dEntera}m (Máx: ${config.radio_maximo}m)`);
        }
      },
      (err) => setErrorGps("Error: GPS no disponible."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, sesionDuplicada, token, config, reintentos]);

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-sm border border-white/5 shadow-2xl text-center relative z-10">
        <h1 className="text-xl font-black uppercase italic text-white mb-6 tracking-tighter">Acceso <span className="text-blue-500">Personal</span></h1>
        
        <div className="mb-8 border-b border-white/5 pb-6">
          <div className="text-sm font-bold text-slate-300 mb-1 uppercase tracking-tighter">{user?.nombre}</div>
          <div className="text-[10px] text-blue-400 uppercase tracking-widest font-black italic">{user?.rol}({user?.nivel_acceso})</div>
        </div>

        {!ubicacionOk ? (
          <div className="py-12 px-6 bg-red-500/5 rounded-[35px] border border-red-500/20 mb-8">
            <div className="text-red-500 text-4xl mb-4">📍</div>
            <div className="text-slate-400 text-[10px] leading-relaxed italic uppercase mb-6">{errorGps || "Iniciando sensor..."}</div>
            <button onClick={() => setReintentos(p => p + 1)} className="bg-red-500/20 text-red-500 px-6 py-3 rounded-2xl text-[9px] font-black uppercase border border-red-500/30">🔄 Recalibrar GPS</button>
          </div>
        ) : (
          <div className="p-6 bg-white rounded-[35px] mb-8 inline-block animate-in zoom-in">
            {token && <QRCodeSVG value={token} size={200} level="H" />}
            <div className="mt-4 text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
              VÁLIDO POR {parseInt(config.timer_token) / 1000} SEG • {distancia}m
            </div>
            {/* COORDENADAS DEL GPS ACTUAL */}
            <div className="mt-1 text-[7px] text-slate-400 font-bold uppercase tracking-widest">
              GPS: {coordsActuales.lat.toFixed(6)}, {coordsActuales.lon.toFixed(6)}
            </div>
          </div>
        )}

        <button onClick={() => { localStorage.removeItem('user_session'); router.push('/'); }} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-white/5 rounded-2xl bg-black/20">← Finalizar Sesión</button>
      </div>
    </main>
  );
}