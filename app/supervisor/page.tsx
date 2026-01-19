'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { checkGeofence } from '../../utils/geofence';

// Conectamos con tu base de datos
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SupervisorPage() {
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState({ texto: 'Esperando escaneo...', color: 'text-slate-400' });

  // Lógica para capturar datos del Lector USB
  useEffect(() => {
    let buffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        setQrData(buffer);
        setMsg({ texto: "Código detectado. Ingrese PIN.", color: "text-blue-400" });
        buffer = "";
      } else {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ESTA ES LA FUNCIÓN QUE ACTUALIZAMOS
  const validarAcceso = async () => {
    // 1. Verificamos GPS del Supervisor primero
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const estaEnAlmacen = checkGeofence(pos.coords.latitude, pos.coords.longitude);
      
      if (!estaEnAlmacen) {
        setMsg({ texto: "ERROR: Supervisor fuera de rango GPS", color: "text-red-500" });
        return;
      }

      // 2. Buscamos al empleado en la base de datos por su ID (contenido en el QR)
      setMsg({ texto: "Verificando en base de datos...", color: "text-yellow-500" });
      
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

      // 3. Validamos el PIN que el Admin asignó a ese empleado
      if (pin === empleado.pin_seguridad) {
        // Registramos el éxito en el historial
        await supabase.from('registros_acceso').insert({
          nombre_empleado: empleado.nombre,
          empleado_id: empleado.id,
          tipo_movimiento: 'entrada',
          coordenadas_validacion: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        });

        setMsg({ texto: `ACCESO EXITOSO: ${empleado.nombre} ✅`, color: "text-emerald-500" });
        
        // Limpiamos la pantalla después de 3 segundos para el siguiente empleado
        setTimeout(() => {
          setQrData('');
          setPin('');
          setMsg({ texto: 'Esperando escaneo...', color: 'text-slate-400' });
        }, 3000);
      } else {
        setMsg({ texto: "PIN DE SEGURIDAD INCORRECTO ❌", color: "text-red-500" });
      }
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

        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">
            Hardware: Lector USB Windows 11 Detectado
          </p>
        </div>
      </div>
    </main>
  );
}