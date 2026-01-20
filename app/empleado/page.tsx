'use client';
import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';

// 📍 COORDENADAS DEL ALMACÉN (Ajusta estas a tu ubicación real)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; // Radio de tolerancia

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [qrValue, setQrValue] = useState('');
  const [distancia, setDistancia] = useState<number | null>(null);
  const [enRango, setEnRango] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fórmula de Haversine para calcular distancia entre puntos
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radio de la tierra en metros
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  const generarTokenTemporal = useCallback((docId: string) => {
    // Genera un token basado en el ID y el minuto actual
    const minutoActual = Math.floor(Date.now() / 60000);
    return btoa(`${docId}|${minutoActual}`);
  }, []);

  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    const session = JSON.parse(sessionStr);
    setUser(session);

    const validarUbicacion = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
          setDistancia(Math.round(d));
          setEnRango(d <= RADIO_MAXIMO_METROS);
          setLoading(false);
        },
        () => { alert("Activa el GPS para generar tu acceso"); setLoading(false); },
        { enableHighAccuracy: true }
      );
    };

    validarUbicacion();
    const intervalLoc = setInterval(validarUbicacion, 10000); // Revalida GPS cada 10s
    return () => clearInterval(intervalLoc);
  }, [router]);

  // Efecto para rotar el QR cada minuto
  useEffect(() => {
    if (user && enRango) {
      const actualizarQR = () => setQrValue(generarTokenTemporal(user.documento_id));
      actualizarQR();
      const intervalQR = setInterval(actualizarQR, 30000); // Intenta actualizar cada 30s para evitar desfases
      return () => clearInterval(intervalQR);
    }
  }, [user, enRango, generarTokenTemporal]);

  if (!user || loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center text-white font-black italic">VERIFICANDO GPS...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 w-full max-w-sm text-center shadow-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">{user.nombre}</h1>
          <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em]">Acceso Seguro</p>
        </div>
        
        {enRango ? (
          <>
            <div className="bg-white p-5 rounded-[35px] shadow-inner mb-6 inline-block">
              <QRCodeSVG value={qrValue} size={180} level="H" />
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 py-2 px-4 rounded-full mb-6">
              <p className="text-[9px] text-emerald-500 font-black uppercase">📍 Estás en zona autorizada</p>
            </div>
          </>
        ) : (
          <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[35px] mb-6">
            <p className="text-4xl mb-4">🚫</p>
            <p className="text-red-500 font-black uppercase text-xs italic">Fuera de Rango</p>
            <p className="text-white text-sm mt-2 font-bold">Te encuentras a <span className="text-red-500">{distancia} metros</span> del almacén.</p>
            <p className="text-slate-500 text-[9px] mt-4 uppercase">Acércate a menos de 50m para generar el QR</p>
          </div>
        )}

        <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-slate-600 text-[10px] font-black uppercase hover:text-red-500 tracking-widest">Cerrar Sesión</button>
      </div>
    </main>
  );
}