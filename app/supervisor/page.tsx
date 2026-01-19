'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { checkGeofence } from '../../utils/geofence';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
      scanner.clear(); 
    }, () => {});

    return () => {
        scanner.clear().catch(err => console.error("Error al limpiar scanner", err));
    };
  }, []);

  // 2. LECTOR USB (Para Windows 11)
  useEffect(() => {
    let buffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.length > 3) { 
          setQrData(buffer);
          setMsg({ texto: "Lector USB detectado. Ingrese PIN.", color: "text-blue-400" });
        }
        buffer = "";
      } else if (e.key.length === 1) { 
        buffer += e.key; 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const validarAcceso = async () => {
    if (!navigator.geolocation) {
      setMsg({ texto: "GPS no soportado", color: "text-red-500" });
      return;
    }

    setMsg({ texto: "Validando ubicación...", color: "text-yellow-500" });

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const estaEnAlmacen = checkGeofence(pos.coords.latitude, pos.coords.longitude);
        
        if (!estaEnAlmacen) {
          setMsg({ texto: "FUERA DE RANGO GPS", color: "text-red-500" });
          return;
        }

        const { data: empleado, error } = await supabase
          .from('empleados')
          .select('*')
          .eq('cedula_id', qrData)
          .eq('activo', true)
          .single();

        if (error || !empleado) {
          setMsg({ texto: "EMPLEADO NO ENCONTRADO", color: "text-red-500" });
          return;
        }

        if (pin === empleado.pin_seguridad) {
          await supabase.from('registros_acceso').insert({
            nombre_empleado: empleado.nombre,
            empleado_id: empleado.id,
            tipo_movimiento: 'entrada',
            coordenadas_validacion: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          });

          setMsg({ texto: `BIENVENIDO ${empleado.nombre} ✅`, color: "text-emerald-500" });
          
          setTimeout(() => {
            setQrData('');
            setPin('');
            setMsg({ texto: 'Esperando escaneo...', color: 'text-slate-400' });
            // Forzamos un pequeño reset del componente para reactivar la cámara si es necesario
            window.location.reload(); 
          }, 3000);
        } else {
          setMsg({ texto: "PIN INCORRECTO ❌", color: "text-red-500" });
        }
      } catch (err) {
        setMsg({ texto: "Error de conexión", color: "text-red-500" });
      }
    }, () => {
      setMsg({ texto: "Activa el GPS", color: "text-red-500" });
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center p-6 text-white font-sans">
      <div className="w-full max-w-md bg-slate-900 p-6 rounded-3xl border border-blue-500 shadow-2xl">
        <h1 className="text-center text-xl font-bold mb-4 text-blue-400">MODO SUPERVISOR</h1>

        {!qrData && (
          <div id="reader" className="overflow-hidden rounded-xl border border-slate-700 bg-black mb-4"></div>
        )}

        <div className={`p-4 rounded-xl bg-slate-800 text-center font-bold border border-slate-700 ${msg.color}`}>
          {msg.texto}
        </div>

        {qrData && (
          <div className="mt-6 space-y-4 animate-in fade-in zoom-in duration-300">
            <input 
              type="password" 
              placeholder="PIN" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-4 bg-slate-950 rounded-xl border border-blue-500 text-center text-3xl outline-none"
              autoFocus
            />
            <button 
              onClick={validarAcceso}
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-lg transition-all active:scale-95"
            >
              VALIDAR AHORA
            </button>
            <button 
              onClick={() => { setQrData(''); setMsg({ texto: 'Esperando escaneo...', color: 'text-slate-400' }); window.location.reload(); }}
              className="w-full text-slate-500 text-sm"
            >
              Cancelar / Escanear de nuevo
            </button>
          </div>
        )}

        <div className="mt-8 text-center opacity-30">
          <p className="text-[10px] uppercase tracking-widest">
            Híbrido: Cámara + Lector USB
          </p>
        </div>
      </div>
    </main>
  );
}