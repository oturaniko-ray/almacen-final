'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [errorGps, setErrorGps] = useState('');
  const [distancia, setDistancia] = useState<number | null>(null);
  const [config, setConfig] = useState<any>({ 
    timer_token: 120000, 
    almacen_lat: 0, 
    almacen_lon: 0, 
    radio_maximo: 50 
  });

  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig({
        timer_token: parseInt(cfgMap.timer_token) || 120000,
        almacen_lat: parseFloat(cfgMap.almacen_lat || cfgMap.gps_latitud) || 0,
        almacen_lon: parseFloat(cfgMap.almacen_lon || cfgMap.gps_longitud) || 0,
        radio_maximo: parseInt(cfgMap.radio_maximo) || 50
      });
    }
  };

  useEffect(() => {
    if (config.almacen_lat === 0) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        setDistancia(Math.round(d));
        if (d <= config.radio_maximo) {
          setUbicacionOk(true);
          setErrorGps('');
        } else {
          setUbicacionOk(false);
          setErrorGps(`Fuera de rango (${Math.round(d)}m)`);
        }
      },
      (err) => setErrorGps("Error al obtener ubicación"),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [config]);

  useEffect(() => {
    if (ubicacionOk && user) {
      const interval = setInterval(() => {
        const rawToken = `${user.documento_id}|${Date.now()}`;
        setToken(btoa(rawToken));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [ubicacionOk, user]);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">Mi Identificador QR</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">{user?.nombre}</p>

        {!ubicacionOk ? (
          <div className="bg-white p-10 rounded-[45px] shadow-xl border border-red-100 animate-pulse">
            <div className="text-red-500 text-4xl mb-4">📍</div>
            <p className="text-red-600 font-black text-xs uppercase mb-2">Error de Ubicación</p>
            <p className="text-slate-500 text-[10px] uppercase italic">{errorGps || "Validando GPS..."}</p>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-[50px] shadow-2xl inline-block border-4 border-emerald-500/20">
            {token && <QRCodeSVG value={token} size={220} level="H" />}
            <div className="mt-6 flex flex-col gap-1">
              <span className="text-[9px] font-black text-emerald-600 uppercase">Estás en rango ✅</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">A {distancia}m del Almacén</span>
            </div>
          </div>
        )}
        <button onClick={() => router.push('/')} className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-blue-600 transition-colors">← Cerrar Sesión</button>
      </div>
    </main>
  );
}