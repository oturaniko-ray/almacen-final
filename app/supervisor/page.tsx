'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { checkGeofence } from '../../utils/geofence';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState({ texto: 'Esperando escaneo...', color: 'text-slate-400' });

  // 1. INICIALIZAR CÁMARA (Para Móvil)
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    
    scanner.render((decodedText) => {
      setQrData(decodedText);
      setMsg({ texto: "Código capturado. Ingrese PIN.", color: "text-blue-400" });
      scanner.clear(); // Detiene la cámara tras leer
    }, (error) => { /* Ignorar errores de escaneo continuo */ });

    return () => scanner.clear();
  }, []);

  // 2. LECTOR USB (Para Windows 11)
  useEffect(() => {
    let buffer = "";
    const handleKeyDown = (e: any) => {
      if (e.key === 'Enter') {
        if (buffer.length > 5) { // Evita ruidos de teclado
          setQrData(buffer);
          setMsg({ texto: "Lector USB detectado. Ingrese PIN.", color: "text-blue-400" });
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const validarAcceso = async () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      if (!checkGeofence(pos.coords.latitude, pos.coords.longitude)) {
        setMsg({ texto: "ERROR: Supervisor fuera de rango GPS", color: "text-red-500" });
        return;
      }

      const { data: empleado } = await supabase.from('empleados')
        .select('*').eq('cedula_id', qrData).eq('activo', true).single();

      if (!empleado) {
        setMsg({ texto: "EMPLEADO NO ENCONTRADO", color: "text-red-500" });
        return;
      }

      if (pin === empleado.pin_seguridad) {
        await supabase.from('registros_acceso').insert({
          nombre_empleado: empleado.nombre,
          tipo_movimiento: 'entrada',
          coordenadas_validacion: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        });
        setMsg({ texto: `BIENVENIDO ${empleado.nombre} ✅`, color: "text-emerald-500" });
        setTimeout(() => window.location.reload(), 3000); // Reinicia para el siguiente
      } else {
        setMsg({ texto: "PIN INCORRECTO ❌", color: "text-red-500" });
      }
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center p-6 text-white">
      <div className="w-full max-w-md bg-slate-900 p-6 rounded-3xl border border-blue-500 shadow-2xl">
        <h1 className="text-center text-xl font-bold mb-4 text-blue-400">MODO SUPERVISOR</h1>
        
        {/* AQUÍ SE ACTIVA LA CÁMARA */}
        {!qrData && (
          <div id="reader" className="overflow-hidden rounded-xl border border-slate-700 bg-black"></div>
        )}

        <div className={`mt-4 p-4 rounded-xl bg-slate-800 text-center font-bold ${msg.color}`}>
          {msg.texto}
        </div>

        {qrData && (
          <div className="mt-6 space-y-4">
            <input 
              type="password" placeholder="PIN" value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-4 bg-slate-950 rounded-xl border border-blue-500 text-center text-2xl"
              autoFocus
            />
            <button onClick={validarAcceso} className="w-full bg-blue-600 py-4 rounded-xl font-bold">
              VALIDAR AHORA
            </button>
          </div>
        )}
      </div>
    </main>
  );
}