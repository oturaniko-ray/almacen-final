'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SupervisorPage() {
  const [authorized, setAuthorized] = useState(false);
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [cedulaManual, setCedulaManual] = useState('');
  const [modoManual, setModoManual] = useState(false);
  const [msg, setMsg] = useState({ texto: 'Escanee un código QR', color: 'text-slate-400' });
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    // Solo permitimos acceso si es admin o supervisor
    if (user.rol === 'supervisor' || user.rol === 'admin') {
      setAuthorized(true);
    } else {
      router.push('/');
    }

    // Lector de código de barras / QR (emulación de teclado)
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (modoManual) return; // Desactivar lector mientras se escribe manualmente

      if (e.key === 'Enter') {
        if (buffer.length > 5) {
          setQrData(buffer);
          buffer = "";
          setMsg({ texto: "QR Detectado. Ingrese PIN del empleado.", color: "text-blue-400" });
        }
      } else {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [router, modoManual]);

  // FUNCIÓN PRINCIPAL DE REGISTRO
  const registrarAcceso = async (idEmpleado: string, pinEmpleado: string, esManual: boolean) => {
    try {
      const { data: emp, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('cedula_id', idEmpleado)
        .eq('pin_seguridad', pinEmpleado)
        .eq('activo', true)
        .single();

      if (error || !emp) {
        setMsg({ texto: "Cédula o PIN incorrectos", color: "text-red-500" });
        return;
      }

      // Insertar registro con flag de emergencia si es manual
      const { error: insError } = await supabase.from('registros_acceso').insert([{
        empleado_id: emp.id,
        nombre_empleado: emp.nombre,
        tipo_movimiento: 'entrada',
        fecha_hora: new Date().toISOString(),
        detalles: esManual ? "INGRESO MANUAL (EMERGENCIA / FALLO GPS)" : "INGRESO QR"
      }]);

      if (insError) throw insError;

      setMsg({ texto: `✅ ${esManual ? 'MANUAL:' : 'QR:'} ${emp.nombre} registrado`, color: "text-emerald-500" });
      
      // Limpiar campos
      setQrData('');
      setPin('');
      setCedulaManual('');
      setModoManual(false);

    } catch (err) {
      setMsg({ texto: "Error en la base de datos", color: "text-red-500" });
    }
  };

  const handleValidarQR = () => {
    try {
      const data = JSON.parse(qrData);
      const timestampQR = new Date(data.t).getTime();
      const ahora = new Date().getTime();
      const diferenciaSegundos = (ahora - timestampQR) / 1000;

      if (diferenciaSegundos > 120) { // El QR expira en 2 min
        setMsg({ texto: "QR Expirado. El empleado debe generar uno nuevo.", color: "text-red-500" });
        return;
      }
      registrarAcceso(data.id, pin, false);
    } catch {
      setMsg({ texto: "QR Inválido o corrupto", color: "text-red-500" });
    }
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-sm text-center shadow-2xl">
        <h1 className="text-xl font-bold mb-6">Panel de Supervisor</h1>
        
        <div className={`p-4 rounded-xl bg-slate-800 mb-6 font-bold transition-all ${msg.color}`}>
          {msg.texto}
        </div>

        {/* FLUJO A: VALIDACIÓN POR QR */}
        {qrData && !modoManual && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <p className="text-xs text-slate-500 uppercase tracking-widest">Validando ID: {JSON.parse(qrData).id}</p>
            <input 
              type="password" 
              placeholder="PIN DEL EMPLEADO" 
              className="w-full p-4 bg-slate-950 rounded border border-blue-500 text-center text-2xl"
              value={pin}
              onChange={e => setPin(e.target.value)}
              autoFocus
            />
            <button 
              onClick={handleValidarQR}
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-colors"
            >
              CONFIRMAR ENTRADA
            </button>
            <button onClick={() => {setQrData(''); setPin('');}} className="text-slate-500 text-sm">Cancelar</button>
          </div>
        )}

        {/* FLUJO B: PLAN B MANUAL (EMERGENCIA) */}
        {modoManual ? (
          <div className="space-y-4 animate-in slide-in-from-bottom duration-300">
            <h2 className="text-red-400 text-sm font-bold">REGISTRO DE EMERGENCIA</h2>
            <input 
              type="text" 
              placeholder="CÉDULA / ID" 
              className="w-full p-3 bg-slate-950 rounded border border-slate-700"
              value={cedulaManual}
              onChange={e => setCedulaManual(e.target.value)}
            />
            <input 
              type="password" 
              placeholder="PIN DEL EMPLEADO" 
              className="w-full p-3 bg-slate-950 rounded border border-slate-700 text-center"
              value={pin}
              onChange={e => setPin(e.target.value)}
            />
            <button 
              onClick={() => registrarAcceso(cedulaManual, pin, true)}
              className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold"
            >
              FORZAR REGISTRO
            </button>
            <button 
              onClick={() => {setModoManual(false); setMsg({texto: 'Escanee un QR', color: 'text-slate-400'});}} 
              className="text-slate-500 text-sm"
            >
              Volver al Escáner
            </button>
          </div>
        ) : (
          !qrData && (
            <button 
              onClick={() => {setModoManual(true); setMsg({texto: 'Modo Manual Activo', color: 'text-red-400'});}}
              className="mt-4 text-slate-500 border border-slate-800 px-4 py-2 rounded-full text-xs hover:bg-slate-800 transition-all"
            >
              ¿Falla el GPS o el QR? Usar modo manual
            </button>
          )
        )}
      </div>
      
      <button 
        onClick={() => { localStorage.clear(); router.push('/'); }} 
        className="mt-8 text-slate-600 hover:text-white text-xs uppercase tracking-tighter"
      >
        Salir del Panel
      </button>
    </main>
  );
}