'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONFIGURACIÓN UNIFICADA
// 🔴 CAMBIO INICIO: Coordenadas unificadas con Supervisor
const ALMACEN_LAT = 40.59682191301211; 
const ALMACEN_LON = -3.5952475579699485;
// 🔴 CAMBIO FIN
const RADIO_MAXIMO_METROS = 50; 
const TIEMPO_EXPIRACION_QR_MS = 120000;

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [errorGps, setErrorGps] = useState('');
  const [distancia, setDistancia] = useState<number | null>(null);
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);

    const canalSesion = supabase.channel('empleado-session-control');
    canalSesion
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.email === currentUser.email && payload.payload.id !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => { localStorage.removeItem('user_session'); router.push('/'); }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSesion.send({ type: 'broadcast', event: 'nueva-sesion', payload: { id: sessionId.current, email: currentUser.email } });
        }
      });

    return () => { supabase.removeChannel(canalSesion); };
  }, [router]);

  useEffect(() => {
    if (!user || sesionDuplicada) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
        setDistancia(Math.round(dist));
        
        if (dist <= RADIO_MAXIMO_METROS) {
          setUbicacionOk(true);
          setErrorGps('');
          // 🔴 CAMBIO INICIO: Estructura de token unificada (Nombre|ID|Timestamp)
          const nuevoToken = btoa(`${user.nombre}|${user.documento_id}|${Date.now()}`);
          // 🔴 CAMBIO FIN
          setToken(nuevoToken);
        } else {
          setUbicacionOk(false);
          setToken('');
          setErrorGps(`Fuera de rango (${Math.round(dist)}m)`);
        }
      },
      (err) => setErrorGps("GPS no disponible o denegado"),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, sesionDuplicada]);

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
          <p className="text-white">Se ha iniciado sesión en otro dispositivo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-sm border border-white/5 shadow-2xl text-center relative z-10">
        <h1 className="text-xl font-black uppercase italic text-blue-500 mb-6 tracking-tighter">Acceso Personal</h1>
        
        <div className="mb-8">
          <div className="text-sm font-bold text-slate-300 mb-1">{user?.nombre}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">{user?.rol}</div>
        </div>

        {!ubicacionOk ? (
          <div className="py-12 px-6 bg-red-500/5 rounded-[35px] border border-red-500/20 mb-8">
            <div className="text-red-500 text-4xl mb-4">📍</div>
            <div className="text-red-500 font-black text-xs uppercase mb-2">Fuera de Zona</div>
            <div className="text-slate-400 text-[10px] leading-relaxed italic">{errorGps || "Acércate al almacén para generar tu código."}</div>
          </div>
        ) : (
          <div className="p-6 bg-white rounded-[35px] shadow-[0_0_40px_rgba(37,99,235,0.2)] mb-8 inline-block animate-in zoom-in duration-500">
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
      </div>
    </main>
  );
}