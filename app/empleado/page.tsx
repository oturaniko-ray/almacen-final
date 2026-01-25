'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONFIGURACIÓN
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; 
const TIEMPO_EXPIRACION_QR_MS = 120000; // 2 minutos en milisegundos

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [errorGps, setErrorGps] = useState('');
  const [distancia, setDistancia] = useState<number | null>(null);
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  // --- LÓGICA DE CONTROL Y SEGURIDAD ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.push('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);
    validarUbicacion();

    // 1. CANAL PARA SESIÓN ÚNICA
    const canalSesion = supabase.channel('empleado-session-monitor');
    canalSesion
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.userEmail === currentUser.email && payload.payload.sid !== sessionId.current) {
          setSesionDuplicada(true);
          localStorage.removeItem('user_session');
          setTimeout(() => router.push('/'), 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSesion.send({
            type: 'broadcast',
            event: 'nueva-sesion',
            payload: { sid: sessionId.current, userEmail: currentUser.email },
          });
        }
      });

    return () => { supabase.removeChannel(canalSesion); };
  }, [router]);

  // --- TEMPORIZADOR DE 2 MINUTOS PARA EL QR ---
  useEffect(() => {
    if (ubicacionOk) {
      const timer = setTimeout(() => {
        localStorage.removeItem('user_session');
        router.push('/');
      }, TIEMPO_EXPIRACION_QR_MS);

      return () => clearTimeout(timer);
    }
  }, [ubicacionOk, router]);

  const validarUbicacion = () => {
    if (!navigator.geolocation) {
      setErrorGps("El navegador no soporta GPS");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
        setDistancia(Math.round(d));
        
        if (d <= RADIO_MAXIMO_METROS) {
          setUbicacionOk(true);
          const current = JSON.parse(localStorage.getItem('user_session')!);
          generarToken(current);
        } else {
          setUbicacionOk(false);
          setErrorGps(`Fuera de rango: Estás a ${Math.round(d)}m.`);
        }
      },
      () => { setErrorGps("Acceso denegado: GPS desactivado."); },
      { enableHighAccuracy: true }
    );
  };

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const generarToken = (userData: any) => {
    const rawString = `${userData.documento_id}|${Date.now()}`;
    setToken(btoa(rawString)); 
  };

  if (sesionDuplicada) {
    return (
      <main className="h-screen bg-black flex items-center justify-center p-10 text-center text-white">
        <div className="bg-red-600/20 border-2 border-red-600 p-10 rounded-[40px] shadow-[0_0_50px_rgba(220,38,38,0.3)] animate-pulse">
          <h2 className="text-4xl font-black text-red-500 mb-4 uppercase italic tracking-tighter">Acceso Denegado</h2>
          <p className="text-white text-xl font-bold">Sesión abierta en otro dispositivo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-sm bg-[#0f172a] p-8 rounded-[45px] border border-white/5 shadow-2xl relative overflow-hidden text-center">
        
        <div className="mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <span className="text-2xl">👤</span>
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">{user?.nombre}</h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">{user?.rol}</p>
        </div>

        {!ubicacionOk ? (
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[30px] mb-6">
            <p className="text-red-500 font-bold text-xs uppercase mb-2">⚠️ Ubicación Requerida</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">{errorGps}</p>
            <button onClick={validarUbicacion} className="mt-4 text-[10px] font-black uppercase text-white bg-red-600 px-4 py-2 rounded-full">Reintentar GPS</button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-[35px] shadow-[0_0_50px_rgba(37,99,235,0.2)] mb-8 inline-block animate-in zoom-in duration-500">
            {token && <QRCodeSVG value={token} size={200} level="H" includeMargin={false} />}
            <div className="mt-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">
              ID: {user?.documento_id} • EXPIRA EN 2 MIN
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
            Presente este código al supervisor <br/> 
            {ubicacionOk ? "La sesión se cerrará automáticamente en 2 minutos." : `Estás a ${distancia ?? '--'}m del área.`}
          </p>
          
          <button 
            onClick={() => { localStorage.removeItem('user_session'); router.push('/'); }} 
            className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            ← Salir y Cerrar Sesión
          </button>
        </div>

        {ubicacionOk && (
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50 shadow-[0_0_15px_#3b82f6] animate-[scan_3s_linear_infinite]"></div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(600px); opacity: 0; }
        }
      `}</style>
    </main>
  );
}