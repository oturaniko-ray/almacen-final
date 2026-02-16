'use client';
import { useState } from 'react';
import { getCurrentLocation } from '@/lib/locationService';

export default function GPSDiagnostic() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState<any>(null);

  const checkGPS = async () => {
    setStatus('checking');
    setMessage('Verificando GPS...');
    
    try {
      // Verificar soporte del navegador
      if (!navigator.geolocation) {
        setStatus('error');
        setMessage('❌ Tu navegador no soporta geolocalización');
        return;
      }

      // Verificar permisos
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        
        if (permission.state === 'denied') {
          setStatus('error');
          setMessage('❌ Permiso de ubicación denegado. Habilítalo en la configuración de tu navegador.');
          return;
        }
      } catch (permError) {
        // Algunos navegadores no soportan permissions.query
        console.log('No se pudo verificar permisos');
      }

      // Intentar obtener ubicación
      const location = await getCurrentLocation();
      
      if (location) {
        setStatus('success');
        setMessage(`✅ Ubicación obtenida vía ${location.source === 'gps' ? 'GPS' : location.source === 'ip' ? 'IP' : 'Caché'}`);
        setDetails({
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          source: location.source,
          address: location.address
        });
      } else {
        setStatus('error');
        setMessage('❌ No se pudo obtener ubicación. Verifica que el GPS esté activado.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('❌ Error inesperado al obtener ubicación');
      console.error(error);
    }
  };

  return (
    <div className="bg-[#0f172a] p-4 rounded-xl border border-white/5 mt-4">
      <h3 className="text-sm font-black text-white uppercase mb-3 flex items-center gap-2">
        <span className="text-blue-400">🔍</span>
        DIAGNÓSTICO GPS
      </h3>
      
      <button
        onClick={checkGPS}
        disabled={status === 'checking'}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition-all disabled:opacity-50 mb-3 w-full"
      >
        {status === 'checking' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            VERIFICANDO...
          </span>
        ) : (
          'VERIFICAR GPS'
        )}
      </button>

      {message && (
        <div className={`p-3 rounded-lg text-xs ${
          status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
          status === 'error' ? 'bg-rose-500/20 text-rose-400' :
          'bg-blue-500/20 text-blue-400'
        }`}>
          {message}
        </div>
      )}

      {details && (
        <div className="mt-3 space-y-1 text-[9px] font-mono bg-black/40 p-3 rounded-lg">
          <p className="text-slate-400">📍 Latitud: <span className="text-white">{details.lat.toFixed(6)}</span></p>
          <p className="text-slate-400">📍 Longitud: <span className="text-white">{details.lng.toFixed(6)}</span></p>
          <p className="text-slate-400">📡 Precisión: <span className="text-white">{details.accuracy?.toFixed(0)}m</span></p>
          <p className="text-slate-400">🔌 Fuente: <span className={`${
            details.source === 'gps' ? 'text-emerald-400' : 
            details.source === 'ip' ? 'text-blue-400' : 
            'text-amber-400'
          }`}>{details.source.toUpperCase()}</span></p>
          {details.address && (
            <p className="text-slate-400 mt-2 border-t border-white/5 pt-2">
              📍 <span className="text-white text-[8px]">{details.address}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}