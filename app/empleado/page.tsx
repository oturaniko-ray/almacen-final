'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONFIGURACIÓN DE ALGORITMO ORIGINAL
const ALMACEN_LAT = 40.59682191301211; 
const ALMACEN_LON = -3.5952475579699485;
const RADIO_MAXIMO_METROS = 50; 
const TIEMPO_EXPIRACION_QR_MS = 120000; // 2 minutos

export default function EmpleadoQRPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [distancia, setDistancia] = useState<number | null>(null);
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);

    // Algoritmo de Geolocalización
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
        setDistancia(Math.round(d));
        setUbicacionOk(d <= RADIO_MAXIMO_METROS);
      },
      (err) => console.error("Error GPS:", err),
      { enableHighAccuracy: true }
    );

    // Generador de Token QR cada 2 min
    const interval = setInterval(() => generarToken(currentUser), 2000);
    generarToken(currentUser);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
    };
  }, []);

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const generarToken = (u: any) => {
    const data = {
      id: u.id,
      email: u.email,
      ts: Date.now(),
      sid: sessionId.current
    };
    setToken(btoa(JSON.stringify(data)));
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-md text-center">
        <header className="mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Acceso Personal</h1>
          <p className="text-blue-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">{user?.nombre}</p>
        </header>

        {/* ÁREA DEL QR */}
        <div className={`relative p-8 rounded-[45px] border-2 transition-all duration-500 ${ubicacionOk ? 'border-emerald-500 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          {!ubicacionOk ? (
            <div className="py-12">
              <span className="text-4xl block mb-4">📍</span>
              <p className="text-xs font-black uppercase text-red-500">Fuera de Rango</p>
              <p className="text-[10px] text-slate-500 mt-2 uppercase">Debes estar a menos de {RADIO_MAXIMO_METROS}m del almacén.<br/>Distancia actual: {distancia ?? '--'}m</p>
            </div>
          ) : (
            <>
              <div className="bg-white p-6 rounded-[30px] inline-block shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                {token && <QRCodeSVG value={token} size={220} level="H" />}
              </div>
              <div className="mt-6">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">● QR Dinámico Activo</p>
                <p className="text-[8px] text-slate-500 uppercase mt-1">Expira y se regenera cada 2 min</p>
              </div>
            </>
          )}
        </div>

        <div className="mt-12 space-y-6">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
            Presente este código al supervisor para registrar <br/> su entrada o salida del recinto.
          </p>
          
          <button 
            onClick={() => { localStorage.removeItem('user_session'); router.push('/'); }} 
            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all border-b border-transparent hover:border-white"
          >
            ← Cerrar Sesión y Salir
          </button>
        </div>
      </div>
      
      {/* Indicador de posición plana (sin itálica) */}
      <div className="fixed bottom-6 text-[8px] font-black text-slate-700 uppercase tracking-[0.5em]">
        Status: {ubicacionOk ? 'Localización Verificada' : 'Buscando Señal GPS'}
      </div>
    </main>
  );
}