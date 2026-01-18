'use client';
import { useState, useEffect } from 'react';
import { checkGeofence } from '../../utils/geofence';

export default function SupervisorPage() {
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState({ texto: 'Esperando escaneo...', color: 'text-slate-400' });

  // Lógica para Lector USB (Windows 11)
  useEffect(() => {
    let buffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { // El lector USB siempre manda 'Enter' al final
        setQrData(buffer);
        setMsg({ texto: "Código capturado. Ingrese PIN para validar.", color: "text-blue-400" });
        buffer = "";
      } else {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const validarAcceso = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const estaEnAlmacen = checkGeofence(pos.coords.latitude, pos.coords.longitude);
      
      if (!estaEnAlmacen) {
        setMsg({ texto: "ERROR: Supervisor fuera de rango GPS", color: "text-red-500" });
        return;
      }

      if (pin === "1234") { // Aquí luego conectaremos con tu base de datos
        setMsg({ texto: "ACCESO AUTORIZADO ✅", color: "text-emerald-500" });
        // Limpiar después de 3 segundos
        setTimeout(() => { setQrData(''); setPin(''); setMsg({ texto: 'Esperando escaneo...', color: 'text-slate-400' }); }, 3000);
      } else {
        setMsg({ texto: "PIN INCORRECTO ❌", color: "text-red-500" });
      }
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-slate-900 p-8 rounded-3xl border-2 border-blue-500 w-full max-w-md shadow-[0_0_30px_rgba(59,130,246,0.3)]">
        <h1 className="text-xl font-bold mb-6 text-center">Panel del Supervisor</h1>
        
        <div className={`p-4 mb-6 rounded-xl bg-slate-800 border border-slate-700 text-center font-bold ${msg.color}`}>
          {msg.texto}
        </div>

        {qrData && (
          <div className="mb-6 animate-pulse">
            <p className="text-xs text-slate-500 text-center mb-2">ID Detectado: {qrData.substring(0, 10)}...</p>
            <input 
              type="password" 
              placeholder="PIN DE SUPERVISOR"
              className="w-full p-4 bg-slate-800 rounded-xl border border-blue-500 text-center text-2xl tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
            <button 
              onClick={validarAcceso}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-all"
            >
              AUTORIZAR AHORA
            </button>
          </div>
        )}
        
        <p className="text-[10px] text-slate-600 text-center mt-4">
          Modo Lector USB Activo (Windows 11)
        </p>
      </div>
    </main>
  );
}