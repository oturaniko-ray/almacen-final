'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 COORDENADAS DEL ALMACÉN (Ajusta estas a tu ubicación real)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; // Radio de tolerancia

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [errorGps, setErrorGps] = useState('');
  const [distancia, setDistancia] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (!session) {
      router.push('/');
      return;
    }
    const userData = JSON.parse(session);
    setUser(userData);
    validarUbicacion();
  }, []);

  // Validación de Geofencing
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
          generarToken(JSON.parse(localStorage.getItem('user_session')!));
        } else {
          setUbicacionOk(false);
          setErrorGps(`Fuera de rango: Estás a ${Math.round(d)}m.`);
        }
      },
      () => {
        setErrorGps("Acceso denegado: GPS desactivado.");
      },
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
    // Generamos un token que incluye Documento + Timestamp para evitar capturas de pantalla viejas
    const rawString = `${userData.documento_id}|${Date.now()}`;
    setToken(btoa(rawString)); // Codificación Base64
  };

  const handleLogout = () => {
    localStorage.removeItem('user_session');
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-sm bg-[#0f172a] p-8 rounded-[45px] border border-white/5 shadow-2xl relative overflow-hidden text-center">
        
        {/* Header de Perfil */}
        <div className="mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <span className="text-2xl">👤</span>
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">{user?.nombre}</h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">{user?.rol}</p>
        </div>

        {/* Estado de Ubicación */}
        {!ubicacionOk ? (
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[30px] mb-6">
            <p className="text-red-500 font-bold text-xs uppercase mb-2">⚠️ Bloqueo de Seguridad</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">{errorGps}</p>
            <button onClick={validarUbicacion} className="mt-4 text-[10px] font-black uppercase text-white bg-red-600 px-4 py-2 rounded-full">Reintentar GPS</button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-[35px] shadow-[0_0_50px_rgba(37,99,235,0.2)] mb-8 inline-block animate-in zoom-in duration-500">
            {token && (
              <QRCodeSVG 
                value={token} 
                size={200} 
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "/favicon.ico",
                  x: undefined, y: undefined, height: 24, width: 24, excavate: true,
                }}
              />
            )}
            <div className="mt-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">
              ID: {user?.documento_id} • TOKEN ACTIVO
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
            Presente este código al supervisor <br/> dentro del área de marcación ({distancia ?? '--'}m)
          </p>
          
          <button 
            onClick={() => router.push('/')} 
            className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            ← Volver al Menú
          </button>
        </div>

        {/* Efecto de escaneo decorativo */}
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