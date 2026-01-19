'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { checkGeofence } from '../../utils/geofence';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SupervisorPage() {
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState({ texto: 'Esperando escaneo...', color: 'text-slate-400' });

  useEffect(() => {
    let buffer = "";
    const handleKeyDown = (e: any) => { // Usamos 'any' para evitar conflictos de tipos en el build
      if (e.key === 'Enter') {
        if (buffer.length > 0) {
          setQrData(buffer);
          setMsg({ texto: "Código detectado. Ingrese PIN.", color: "text-blue-400" });
        }
        buffer = "";
      } else {
        // Evitamos que teclas de sistema como 'Shift' entren al buffer
        if (e.key.length === 1) buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const validarAcceso = async () => {
    if (!navigator.geolocation) {
      setMsg({ texto: "GPS no soportado en este navegador", color: "text-red-500" });
      return;
    }

    setMsg({ texto: "Validando ubicación...", color: "text-yellow-500" });

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const estaEnAlmacen = checkGeofence(pos.coords.latitude, pos.coords.longitude);
        
        if (!estaEnAlmacen) {
          setMsg({ texto: "ERROR: Supervisor fuera de rango GPS", color: "text-red-500" });
          return;
        }

        const { data: empleado, error } = await supabase
          .from('empleados')
          .select('*')
          .eq('cedula_id', qrData)
          .eq('activo', true)
          .single();

        if (error || !empleado) {
          setMsg({ texto: "QR NO VÁLIDO O EMPLEADO INEXISTENTE", color: "text-red-500" });
          return;
        }

        if (pin === empleado.pin_seguridad) {
          await supabase.from('registros_acceso').insert({
            nombre_empleado: empleado.nombre,
            empleado_id: empleado.id,
            tipo_movimiento: 'entrada',
            coordenadas_validacion: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          });

          setMsg({ texto: `ACCESO EXITOSO: ${empleado.nombre} ✅`, color: "text-emerald-500" });
          
          setTimeout(() => {
            setQrData('');
            setPin('');
            setMsg({ texto: 'Esperando escaneo...', color: 'text-slate-400' });
          }, 3000);
        } else {
          setMsg({ texto: "PIN DE SEGURIDAD INCORRECTO ❌", color: "text-red-500" });
        }
      } catch (err) {
        setMsg({ texto: "Error interno al validar", color: "text-red-500" });
      }
    }, () => {
      setMsg({ texto: "Error: Activa el GPS de tu equipo", color: "text-red-500" });
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
      <div className="bg-slate-900 p-8 rounded-3xl border-2 border-blue-500 w-full max-w-md shadow-2xl">
        <h1 className="text-xl font-bold mb-6 text-center text-blue-400">Escáner de Supervisor</h1>
        
        <div className={`p-4 mb-6 rounded-xl bg-slate-800 border border-slate-700 text-center font-bold ${msg.color}`}>
          {msg.texto}
        </div>

        {qrData && (
          <div className="space-y-4">
            <input 
              type="password" 
              placeholder="PIN DEL EMPLEADO"
              className="w-full p-4 bg-slate-950 rounded-xl border border-blue-500 text-center text-3xl tracking-[1rem] outline-none"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
            <button 
              onClick={validarAcceso}
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all"
            >
              VALIDAR ACCESO
            </button>
          </div>
        )}

        <div className="mt-8 text-center text-slate-600">
          <p className="text-[10px] uppercase tracking-widest">
            Hardware: Lector USB Windows 11
          </p>
        </div>
      </div>
    </main>
  );
}