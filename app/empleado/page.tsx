'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';

// COORDENADAS DEL ALMACÉN (Ajusta estas a tu ubicación real)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; // Margen de 50 metros

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [qrValue, setQrValue] = useState('');
  const [errorGeo, setErrorGeo] = useState('');
  const router = useRouter();

  // Función para calcular distancia entre dos puntos (Fórmula Haversine)
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

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (!session.id) {
      router.push('/');
      return;
    }
    setUser(session);

    const generarQRProtegido = () => {
      if (!navigator.geolocation) {
        setErrorGeo("Tu navegador no soporta geolocalización.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
          
          if (dist <= RADIO_MAXIMO_METROS) {
            setErrorGeo('');
            const data = { id: session.cedula_id, t: new Date().toISOString() };
            setQrValue(JSON.stringify(data));
          } else {
            setQrValue('');
            setErrorGeo(`Fuera de rango. Estás a ${Math.round(dist)}m del almacén.`);
          }
        },
        () => setErrorGeo("Debes permitir el acceso al GPS para marcar asistencia."),
        { enableHighAccuracy: true }
      );
    };

    generarQRProtegido();
    const interval = setInterval(generarQRProtegido, 30000); // Valida y actualiza cada 30s
    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <h1 className="text-2xl font-bold mb-2">Mi Acceso Seguro</h1>
      <p className="text-slate-400 mb-8">{user.nombre}</p>

      {errorGeo ? (
        <div className="bg-red-900/20 border border-red-500 p-6 rounded-2xl text-red-400 max-w-xs">
          {errorGeo}
        </div>
      ) : qrValue ? (
        <div className="bg-white p-6 rounded-3xl shadow-2xl shadow-blue-500/20">
          <QRCodeSVG value={qrValue} size={250} />
          <p className="text-slate-900 text-[10px] mt-4 font-mono uppercase italic">Válido por 30 segundos</p>
        </div>
      ) : (
        <p className="animate-pulse">Validando ubicación...</p>
      )}

      <button onClick={() => { localStorage.clear(); router.push('/'); }} className="mt-10 text-slate-500 underline text-sm">Cerrar Sesión</button>
    </main>
  );
}