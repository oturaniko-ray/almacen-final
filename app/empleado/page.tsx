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
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  const [config, setConfig] = useState<any>({ 
    timer_inactividad: '120000', 
    timer_token: '120000',
    almacen_lat: 40.596801, 
    almacen_lon: -3.595251,
    radio_maximo: 50 
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

    // 1. CANAL DE SESIÓN Y ACTUALIZACIONES DE CONFIGURACIÓN (REALTIME)
    const canalRealtime = supabase.channel('empleado-global-sync');
    
    canalRealtime
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.email === currentUser.email && payload.payload.id !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => { localStorage.removeItem('user_session'); router.push('/'); }, 3000);
        }
      })
      // Escuchar cambios en la configuración (coordenadas, tiempos, etc)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sistema_config' }, () => {
        fetchConfig();
      })
      // Escuchar si el admin desactiva al usuario actual
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empleados', filter: `id=eq.${currentUser.id}` }, (payload) => {
        if (payload.new.activo === false) {
          localStorage.removeItem('user_session');
          router.push('/');
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalRealtime.send({ type: 'broadcast', event: 'nueva-sesion', payload: { id: sessionId.current, email: currentUser.email } });
        }
      });

    return () => { 
        supabase.removeChannel(canalRealtime);
        if (timerSalidaRef.current) clearTimeout(timerSalidaRef.current);
    };
  }, [router]);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig({
        timer_inactividad: cfgMap.timer_inactividad || '120000',
        timer_token: cfgMap.timer_token || '120000',
        almacen_lat: parseFloat(cfgMap.almacen_lat) || 40.596801,
        almacen_lon: parseFloat(cfgMap.almacen_lon) || -3.595251,
        radio_maximo: parseInt(cfgMap.radio_maximo) || 50
      });
    }
  };

  useEffect(() => {
    if (!user || sesionDuplicada) return;
    let timeoutInactividad: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutInactividad) clearTimeout(timeoutInactividad);
      timeoutInactividad = setTimeout(() => {
        localStorage.removeItem('user_session');
        router.push('/');
      }, parseInt(config.timer_inactividad));
    };

    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutInactividad);
      eventos.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, config.timer_inactividad, sesionDuplicada, router]);

  useEffect(() => {
    if (!user || sesionDuplicada) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        setDistancia(Math.round(dist));
        
        if (dist <= config.radio_maximo) {
          setUbicacionOk(true);
          setErrorGps('');
          
          if (!token) {
            const nuevoToken = btoa(`${user.documento_id}|${Date.now()}`);
            setToken(nuevoToken);

            if (timerSalidaRef.current) clearTimeout(timerSalidaRef.current);
            timerSalidaRef.current = setTimeout(() => {
                setToken(''); 
            }, parseInt(config.timer_token)); 
          }
        } else {
          setUbicacionOk(false);
          setToken('');
          if (timerSalidaRef.current) clearTimeout(timerSalidaRef.current);
          setErrorGps(`Fuera de rango (${Math.round(dist)}m)`);
        }
      },
      (err) => setErrorGps("GPS no disponible"),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, sesionDuplicada, token, config]);

  function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  if (sesionDuplicada) {
    return (
      <main className="h-screen bg-black flex items-center justify-center p-10 text-center">
        <div className="bg-red-600/20 border-2 border-red-600 p-10 rounded-[40px] animate-pulse">
          <h2 className="text-4xl font-black text-red-500 mb-4 uppercase italic">Sesión Duplicada</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-sm border border-white/5 shadow-2xl text-center relative z-10">
        
        <h1 className="text-xl font-black uppercase italic text-white mb-6 tracking-tighter">
          Acceso <span className="text-blue-500">Personal</span>
        </h1>
        
        <div className="mb-8">
          <div className="text-sm font-bold text-slate-300 mb-1 uppercase tracking-tighter">{user?.nombre}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black italic">{user?.rol}</div>
        </div>

        {!ubicacionOk ? (
          <div className="py-12 px-6 bg-red-500/5 rounded-[35px] border border-red-500/20 mb-8 transition-all">
            <div className="text-red-500 text-4xl mb-4">📍</div>
            <div className="text-red-500 font-black text-xs uppercase mb-2">Fuera de Zona</div>
            <div className="text-slate-400 text-[10px] leading-relaxed italic uppercase">
              {errorGps || "Acércate al almacén."}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-white rounded-[35px] shadow-[0_0_40px_rgba(37,99,235,0.2)] mb-8 inline-block animate-in zoom-in duration-300">
            {token && <QRCodeSVG value={token} size={200} level="H" includeMargin={false} />}
            <div className="mt-4 text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
              VÁLIDO POR {parseInt(config.timer_token) / 1000} SEG
            </div>
          </div>
        )}

        <button 
          onClick={() => { localStorage.removeItem('user_session'); router.push('/'); }} 
          className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all border border-white/5 rounded-2xl bg-black/20"
        >
          ← Finalizar Sesión
        </button>
      </div>
    </main>
  );
}