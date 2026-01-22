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
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [advertenciaAceptada, setAdvertenciaAceptada] = useState(false); 
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const resetearTodo = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch (e) { console.warn(e); }
    setQrData('');
    setPinEmpleadoManual('');
    setPinAutorizador('');
    setModo('menu');
    setDireccion(null);
    setLecturaLista(false);
    setAdvertenciaAceptada(false);
  };

  const volverAtras = () => resetearTodo();

  useEffect(() => {
    if (modo === 'manual' && !advertenciaAceptada) {
      const handleEnterWarning = (e: KeyboardEvent) => {
        if (e.key === 'Enter') setAdvertenciaAceptada(true);
      };
      window.addEventListener('keydown', handleEnterWarning);
      return () => window.removeEventListener('keydown', handleEnterWarning);
    }
  }, [modo, advertenciaAceptada]);

  // Lógica USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          setQrData(buffer.trim());
          setLecturaLista(true);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // Lógica Cámara
  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) {
      const iniciarCamara = async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: 250 }, 
            (text) => {
              setQrData(text);
              setLecturaLista(true);
              scanner.stop().then(() => { scannerRef.current = null; });
            }, 
            () => {}
          );
        } catch (err) { console.error("Error cámara:", err); }
      };
      setTimeout(iniciarCamara, 300); 
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {}); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        let docIdOrEmail = qrData.trim();
        
        if (modo !== 'manual') {
          try {
            const decoded = atob(docIdOrEmail).split('|');
            if (decoded.length === 2) {
              docIdOrEmail = decoded[0];
              if (Date.now() - parseInt(decoded[1]) > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN EXPIRADO");
            }
          } catch (e) {}
        }

        const { data: emp } = await supabase
          .from('empleados')
          .select('*')
          .or(`documento_id.eq.${docIdOrEmail},email.eq.${docIdOrEmail}`)
          .maybeSingle();

        if (!emp) throw new Error("Empleado no encontrado");

        // VALIDACIÓN PIN EMPLEADO (Solo en manual)
        if (modo === 'manual') {
          if (emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN del Empleado incorrecto");
        }

        // VALIDACIÓN DE AUTORIZADOR
        // Manual = Solo Admin | USB/Cámara = Supervisor o Admin
        const rolesPermitidos = modo === 'manual' ? ['admin', 'administrador'] : ['supervisor', 'admin', 'administrador'];
        
        const { data: autorizador } = await supabase
          .from('empleados')
          .select('nombre, rol')
          .eq('pin_seguridad', pinAutorizador)
          .in('rol', rolesPermitidos)
          .maybeSingle();

        if (!autorizador) {
          throw new Error(modo === 'manual' ? "Solo un ADMINISTRADOR puede autorizar acceso manual" : "PIN de Supervisor inválido");
        }

        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `MODO ${modo.toUpperCase()} - Autoriza ${autorizador.rol}: ${autorizador.nombre}`
        }]);

        alert(`✅ Éxito: ${emp.nombre} registrado por ${autorizador.nombre}`);
        resetearTodo();
      } catch (err: any) { 
        alert(`❌ ${err.message}`); 
        setPinAutorizador('');
        if (modo === 'manual') setPinEmpleadoManual('');
      } finally { 
        setAnimar(false); 
      }
    }, () => alert("GPS Obligatorio para registrar"));
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white relative font-sans">
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .animate-laser { animation: laser 2s infinite linear; }
        .animate-blink { animation: blink 1s infinite ease-in-out; }
      `}</style>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl z-10">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-6 text-center tracking-tighter">Panel de Supervisión</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-blue-500 transition-all uppercase">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-emerald-500 transition-all uppercase">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-amber-400 transition-all uppercase">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-4 text-slate-500 font-bold uppercase text-[10px] text-center">← Volver al inicio</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl">SALIDA</button>
            <button onClick={volverAtras} className="mt-4 text-slate-500 font-bold uppercase text-center">← Cancelar</button>
          </div>
        ) : (
          <div className="space-y-6">
            {modo === 'manual' && !advertenciaAceptada ? (
              <div className="bg-amber-400 p-6 rounded-[30px] border-4 border-amber-600 animate-blink text-black shadow-[0_0_30px_rgba(251,191,36,0.4)]">
                <p className="font-black text-center text-sm uppercase mb-4 leading-tight">
                  ⚠️ Solo el supervisor es quién valida el acceso manual, antes de seguir solicite la presencia de algún supervisor presente
                </p>
                <p className="text-[10px] font-bold text-center uppercase opacity-70 italic">Presione [ENTER] para aceptar</p>
              </div>
            ) : (
              <>
                <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all duration-500 ${lecturaLista ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/5'} relative h-32 flex items-center justify-center`}>
                  {!lecturaLista ? (
                    <>
                      {modo === 'manual' ? (
                        <div className="w-full text-center">
                          <p className="text-[10px] font-black text-amber-500 uppercase mb-2 tracking-widest">Documento o Email</p>
                          <input 
                            type="text" autoFocus maxLength={35}
                            className="bg-transparent border-b-2 border-amber-500 text-center text-xl font-bold outline-none w-full px-2" 
                            placeholder="Máx 35 caracteres" value={qrData} 
                            onChange={(e) => setQrData(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && qrData.length > 0) setLecturaLista(true); }}
                          />
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-[10px] font-black text-slate-500 uppercase animate-blink">Esperando Dispositivo</p>
                          <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-laser"></div>
                          {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl overflow-hidden mt-2"></div>}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">✔</div>
                      <p className="text-emerald-500 font-black text-[9px] uppercase">Datos Capturados</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {modo === 'manual' && lecturaLista && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase text-center">1. PIN del Empleado (A ingresar)</p>
                      <input 
                        type="password" placeholder="PIN Personal"
                        className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/5 focus:border-blue-500 outline-none"
                        value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') pinRef.current?.focus(); }}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase text-center">
                      {modo === 'manual' ? '2. PIN del Administrador (Autoriza)' : 'PIN del Supervisor'}
                    </p>
                    <input 
                      ref={pinRef} type="password" placeholder="PIN Seguridad"
                      className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/5 focus:border-blue-500 outline-none"
                      value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador || (modo === 'manual' && !pinEmpleadoManual)}
                    className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase shadow-lg disabled:opacity-30">
                    {animar ? 'PROCESANDO...' : 'REGISTRAR'}
                  </button>
                  <button onClick={volverAtras} className="text-slate-600 font-bold uppercase text-[9px] text-center">✕ Cancelar y Limpiar</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}