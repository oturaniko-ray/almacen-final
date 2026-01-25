'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONFIGURACIÓN ORIGINAL
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; 
const TIEMPO_EXPIRACION_QR_MS = 120000;

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [estaActivo, setEstaActivo] = useState<boolean>(true); // Estado de actividad
  const [cargando, setCargando] = useState(true);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);

    // 1. VALIDACIÓN DE ESTADO ACTIVO
    const verificarEstado = async () => {
      const { data, error } = await supabase
        .from('empleados')
        .select('activo')
        .eq('id', currentUser.id)
        .single();
      
      if (data) {
        setEstaActivo(data.activo);
      }
      setCargando(false);
    };

    verificarEstado();

    // 2. GEOLOCALIZACIÓN
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
        setDistancia(Math.round(d));
        setUbicacionOk(d <= RADIO_MAXIMO_METROS);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    // 3. GENERACIÓN DE TOKEN (Solo si está activo)
    const interval = setInterval(() => {
      if (estaActivo) generarToken(currentUser);
    }, 2000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
    };
  }, [estaActivo]);

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
    const data = { id: u.id, email: u.email, ts: Date.now(), sid: sessionId.current };
    setToken(btoa(JSON.stringify(data)));
  };

  // PANTALLA DE BLOQUEO (EMPLEADO INACTIVO)
  if (!estaActivo && !cargando) {
    return (
      <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-8 text-white font-sans">
        <div className="bg-red-600 p-12 rounded-[45px] text-center shadow-[0_0_60px_rgba(220,38,38,0.4)] border-4 border-white animate-pulse max-w-lg">
          <span className="text-7xl mb-6 block">⚠️</span>
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">Acceso Denegado</h1>
          <p className="font-bold uppercase text-xs tracking-widest leading-relaxed">
            Atención: Su usuario ha sido marcado como <br/> 
            <span className="text-black bg-white px-2 ml-1">INACTIVO</span> en el sistema. <br/> 
            Comuníquese con la administración de la empresa.
          </p>
          <button 
            onClick={() => { localStorage.removeItem('user_session'); router.replace('/'); }}
            className="mt-8 bg-white text-red-600 px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-transform"
          >
            Salir del Sistema
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans overflow-hidden">
      <div className="w-full max-w-sm text-center">
        <header className="mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Acceso Personal</h1>
          <p className="text-blue-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">{user?.nombre}</p>
        </header>

        <div className={`relative p-8 rounded-[45px] border-2 transition-all duration-500 ${ubicacionOk ? 'border-blue-500 bg-blue-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          {!ubicacionOk ? (
            <div className="py-12">
              <span className="text-4xl block mb-4">📍</span>
              <p className="text-xs font-black uppercase text-red-500 tracking-widest">Fuera de Rango</p>
              <p className="text-[10px] text-slate-500 mt-2 uppercase">Distancia: {distancia ?? '--'}m del almacén</p>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-[30px] inline-block shadow-2xl">
              {token && <QRCodeSVG value={token} size={220} level="H" />}
            </div>
          )}
        </div>

        <div className="mt-12 space-y-6">
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
            Presente este código al supervisor para <br/> validar su movimiento de entrada o salida.
          </p>
          
          <button 
            onClick={() => { localStorage.removeItem('user_session'); router.push('/'); }} 
            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all border-b border-transparent hover:border-white"
          >
            ← Cerrar Sesión
          </button>
        </div>
      </div>
    </main>
  );
}