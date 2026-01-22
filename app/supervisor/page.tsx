'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const volverAtras = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch (e) {
      console.error(e);
    }
    setModo('menu');
    setDireccion(null);
    setQrData('');
    setPinEmpleadoManual('');
    setPinSupervisor('');
    setLecturaLista(false);
  };

  const iniciarEscaneo = async () => {
    setModo('camara');
    setTimeout(async () => {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          setQrData(decodedText);
          setLecturaLista(true);
          scanner.stop();
        },
        undefined
      );
    }, 100);
  };

  async function registrarAcceso() {
    if (!pinSupervisor) return;
    setAnimar(true);

    try {
      // 1. Validar Supervisor
      const { data: supervisor, error: errSup } = await supabase
        .from('empleados')
        .select('nombre, rol')
        .eq('pin_seguridad', pinSupervisor)
        .in('rol', ['admin', 'supervisor'])
        .eq('activo', true)
        .single();

      if (errSup || !supervisor) throw new Error('PIN de Supervisor incorrecto o no autorizado');

      let empleadoId = '';
      let nombreEmpleado = '';

      if (modo === 'manual') {
        // Validar Empleado por PIN
        const { data: emp, error: errEmp } = await supabase
          .from('empleados')
          .select('id, nombre')
          .eq('pin_seguridad', pinEmpleadoManual)
          .eq('activo', true)
          .single();
        if (errEmp || !emp) throw new Error('PIN de Empleado incorrecto');
        empleadoId = emp.id;
        nombreEmpleado = emp.nombre;
      } else {
        // Validar por QR (Token)
        const [id, timestamp] = qrData.split('|');
        if (Date.now() - parseInt(timestamp) > TIEMPO_MAX_TOKEN_MS) throw new Error('Código QR expirado');
        
        const { data: emp, error: errEmp } = await supabase
          .from('empleados')
          .select('id, nombre')
          .eq('id', id)
          .eq('activo', true)
          .single();
        if (errEmp || !emp) throw new Error('Empleado no encontrado o inactivo');
        empleadoId = emp.id;
        nombreEmpleado = emp.nombre;
      }

      // 2. Registrar Movimiento
      const { error: errMov } = await supabase.from('registros_acceso').insert([{
        empleado_id: empleadoId,
        nombre_empleado: nombreEmpleado,
        tipo_movimiento: direccion,
        detalles: `Modo: ${modo.toUpperCase()} | Autoriza: ${supervisor.nombre} (${supervisor.rol})`
      }]);

      if (errMov) throw errMov;

      // 3. Actualizar estado de presencia
      await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', empleadoId);

      alert(`${direccion?.toUpperCase()} REGISTRADA: ${nombreEmpleado}`);
      volverAtras();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setAnimar(false);
      setPinSupervisor('');
      setPinEmpleadoManual('');
    }
  }

  if (modo === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-blue-500">Punto de Control</h1>
          <p className="text-[10px] text-slate-500 font-bold tracking-[0.3em] uppercase mt-2">Acceso Supervisado</p>
        </div>

        <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
          <button onClick={() => { setModo('manual'); setDireccion('entrada'); }} className="p-8 bg-[#0f172a] border border-white/5 rounded-[35px] flex flex-col items-center group hover:bg-emerald-600 transition-all shadow-2xl">
            <span className="text-4xl mb-2">📥</span>
            <span className="font-black uppercase italic text-sm">Entrada Manual</span>
          </button>
          <button onClick={() => { setModo('manual'); setDireccion('salida'); }} className="p-8 bg-[#0f172a] border border-white/5 rounded-[35px] flex flex-col items-center group hover:bg-orange-600 transition-all shadow-2xl">
            <span className="text-4xl mb-2">📤</span>
            <span className="font-black uppercase italic text-sm">Salida Manual</span>
          </button>
          <button onClick={iniciarEscaneo} className="p-6 bg-blue-600 rounded-[30px] font-black uppercase italic text-sm shadow-xl hover:scale-105 transition-all">
            📷 Escanear QR de Empleado
          </button>
          <button onClick={() => router.push('/')} className="mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors">
            ← Volver al Inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-6 flex flex-col items-center">
      <div className="w-full max-w-md bg-[#0f172a] rounded-[40px] border border-white/5 p-8 shadow-2xl">
        <h2 className="text-center font-black uppercase italic text-blue-500 mb-8 tracking-tighter">
          {direccion === 'entrada' ? '📥 Registro de Entrada' : '📤 Registro de Salida'}
        </h2>

        {modo === 'camara' && !lecturaLista && (
          <div className="space-y-6">
            <div id="reader" className="overflow-hidden rounded-[30px] border-2 border-blue-500/20"></div>
            <p className="text-center text-[10px] font-bold text-slate-500 animate-pulse uppercase">Escaneando código QR...</p>
          </div>
        )}

        {(lecturaLista || modo === 'manual') && (
          <div className="space-y-8">
            <div className="space-y-6">
              {/* CAMPO PIN EMPLEADO (Solo en modo manual) */}
              {modo === 'manual' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase text-center tracking-widest">
                    1. PIN del Empleado
                  </p>
                  <input 
                    type="password" 
                    placeholder="Escribe PIN Empleado"
                    className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-3xl font-black border-2 border-white/5 focus:border-emerald-500 transition-all outline-none"
                    value={pinEmpleadoManual}
                    onChange={(e) => setPinEmpleadoManual(e.target.value)}
                  />
                </div>
              )}

              {/* CAMPO PIN SUPERVISOR / ADMIN */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase text-center tracking-widest">
                  {modo === 'manual' ? '2. PIN Autorización' : 'Confirmación Autorizada'}
                </p>
                <input 
                  ref={pinRef}
                  type="password" 
                  placeholder="PIN Supervisor"
                  className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-3xl font-black border-2 border-blue-500/10 focus:border-blue-500 transition-all outline-none"
                  value={pinSupervisor}
                  onChange={(e) => setPinSupervisor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={registrarAcceso} 
                disabled={animar || (modo === 'manual' && !pinEmpleadoManual) || !pinSupervisor}
                className={`w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-30 transition-all ${pinSupervisor && !animar ? 'animate-pulse' : ''}`}
              >
                {animar ? 'PROCESANDO...' : 'Confirmar Registro'}
              </button>
              
              <button onClick={volverAtras} className="text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em] hover:text-white transition-colors">
                ✕ Cancelar Operación
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}