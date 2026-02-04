'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState(''); 
  const [pinEmpleado, setPinEmpleado] = useState(''); 
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [pasoManual, setPasoManual] = useState<0 | 1 | 2 | 3>(0); 
  const [gpsReal, setGpsReal] = useState({ lat: 0, lon: 0 });
  const [supervisorSesion, setSupervisorSesion] = useState<{nombre: string, rol: string} | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinEmpRef = useRef<HTMLInputElement>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const inputUsbRef = useRef<HTMLInputElement>(null);
  const docManualRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setSupervisorSesion(JSON.parse(sessionData));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsReal({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const procesarLectura = (texto: string) => {
    try {
      const decoded = atob(texto);
      return decoded.includes('|') ? decoded.split('|')[0] : texto;
    } catch { return texto; }
  };

  // AJUSTE: Función mejorada para actuar como botón de "Volver atrás"
  const volverAtras = useCallback(async () => {
    // Si la cámara está encendida, detenerla antes de salir
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }

    // Si ya hay una lectura lista, resetearla para permitir leer otra vez
    if (lecturaLista || qrData) {
      setQrData('');
      setPinEmpleado('');
      setPinAutorizador('');
      setLecturaLista(false);
      setPasoManual(modo === 'manual' ? 1 : 0);
      if (modo === 'camara') iniciarCamara();
      return;
    }

    // Si no hay lectura, regresar a la selección de ENTRADA/SALIDA
    setDireccion(null);
    setPasoManual(0);
  }, [lecturaLista, qrData, modo]);

  // Esta se mantiene para limpiezas automáticas tras éxito o error
  const resetLecturaTotal = useCallback(async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData('');
    setPinEmpleado('');
    setPinAutorizador('');
    setLecturaLista(false);
    setAnimar(false);
    setPasoManual(0);
    if (modo === 'camara' && direccion) iniciarCamara();
  }, [modo, direccion]);

  const iniciarCamara = async () => {
    try {
      setTimeout(async () => {
        if (!document.getElementById("reader")) return;
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 20, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            setQrData(procesarLectura(decodedText));
            setLecturaLista(true);
            scanner.stop();
            setTimeout(() => pinAutRef.current?.focus(), 300);
          },
          () => {}
        );
      }, 300);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) iniciarCamara();
    if (modo === 'usb' && direccion && !lecturaLista) inputUsbRef.current?.focus();
  }, [modo, direccion, lecturaLista]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    try {
      const { data: emp } = await supabase.from('empleados')
        .select('id, nombre, pin_seguridad')
        .or(`documento_id.eq."${qrData}",email.eq."${qrData}"`)
        .maybeSingle();

      if (!emp) throw new Error("Empleado no identificado");
      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) throw new Error("PIN Empleado incorrecto");
      
      const rolesReq = modo === 'manual' ? ['admin', 'administrador'] : ['supervisor', 'admin', 'administrador'];
      const { data: val } = await supabase.from('empleados')
        .select('nombre')
        .eq('pin_seguridad', String(pinAutorizador))
        .in('rol', rolesReq)
        .maybeSingle();

      if (!val) throw new Error(modo === 'manual' ? "Requiere PIN de Administrador" : "PIN Autorizador incorrecto");

      const firma = `${val.nombre} (${modo.toUpperCase()})`;

      if (direccion === 'entrada') {
        const { error: insErr } = await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, 
          nombre_empleado: emp.nombre,
          hora_entrada: new Date().toISOString(), 
          autoriza_entrada: firma,
          estado: 'activo' 
        }]);
        if (insErr) throw insErr;
        await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
      } else {
        const { data: jActiva } = await supabase.from('jornadas').select('id, hora_entrada').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
        if (!jActiva) throw new Error("Sin registro de entrada activo");

        const diffMs = new Date().getTime() - new Date(jActiva.hora_entrada).getTime();
        const horasDecimales = parseFloat((diffMs / 3600000).toFixed(2));

        const { error: updErr } = await supabase.from('jornadas').update({ 
          hora_salida: new Date().toISOString(), 
          horas_trabajadas: horasDecimales,
          autoriza_salida: firma,
          estado: 'finalizado'
        }).eq('id', jActiva.id);
        
        if (updErr) throw updErr;
        await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
      }

      alert(`✅ Registro exitoso: ${emp.nombre}`);
      resetLecturaTotal();
    } catch (err: any) { 
      alert(`❌ Error: ${err.message}`); 
      setAnimar(false);
      if (modo === 'manual') {
        setPasoManual(1);
        setQrData('');
        setPinEmpleado('');
        setPinAutorizador('');
        setTimeout(() => docManualRef.current?.focus(), 100);
      } else {
        resetLecturaTotal();
      }
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative">
        
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 italic tracking-tighter">Panel Supervisor</h2>
          {modo !== 'menu' && (
            <div className="mt-2">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{supervisorSesion?.nombre}</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">COORD: {gpsReal.lat.toFixed(4)}, {gpsReal.lon.toFixed(4)}</p>
            </div>
          )}
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-blue-600 transition-all border border-white/5">🔌 Scanner / USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-emerald-600 transition-all border border-white/5">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-slate-700 transition-all border border-white/5">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-4 text-slate-600 font-bold uppercase text-[9px] text-center tracking-widest">← Salir del sistema</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl uppercase italic">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl uppercase italic">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-6 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest hover:text-white transition-colors">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-4">
            {modo === 'manual' && pasoManual === 0 && (
              <div className="text-center py-10 animate-pulse">
                <p className="text-yellow-500 font-black text-lg uppercase italic mb-4">
                  ⚠️ Este acceso solo será validado por un supervisor
                </p>
                <button 
                  autoFocus
                  onClick={() => { setPasoManual(1); setTimeout(() => docManualRef.current?.focus(), 100); }}
                  className="px-8 py-2 bg-yellow-600 rounded-full font-bold uppercase text-xs"
                >
                  Presione ENTER para seguir
                </button>
              </div>
            )}

            {(modo !== 'manual' || pasoManual > 0) && (
              <div className={`bg-[#050a14] p-4 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative h-56 flex items-center justify-center overflow-hidden`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && (
                      <div className="text-center">
                        <p className="text-blue-500 font-black animate-pulse uppercase text-xs">A la espera de lectura USB...</p>
                        <input ref={inputUsbRef} type="text" className="opacity-0 absolute" autoFocus onChange={(e) => { 
                          const val = e.target.value;
                          setTimeout(() => {
                             setQrData(procesarLectura(val));
                             setLecturaLista(true);
                             setTimeout(() => pinAutRef.current?.focus(), 200);
                          }, 150); 
                        }} />
                      </div>
                    )}
                    {modo === 'manual' && (
                      <input 
                        ref={docManualRef}
                        type="text" 
                        placeholder="DOCUMENTO / CORREO" 
                        className="bg-transparent text-center text-xl font-black uppercase outline-none w-full" 
                        onKeyDown={(e) => { if(e.key === 'Enter') { setPasoManual(2); setTimeout(() => pinEmpRef.current?.focus(), 200); }}} 
                        value={qrData}
                        onChange={(e) => setQrData(e.target.value)}
                      />
                    )}
                    {modo !== 'manual' && <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>}
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-emerald-500 font-black text-xl uppercase italic">Identidad Validada ✅</p>
                  </div>
                )}
              </div>
            )}

            {modo === 'manual' && pasoManual >= 2 && (
              <input 
                ref={pinEmpRef} 
                type="text" 
                placeholder="PIN EMPLEADO" 
                className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/10 outline-none" 
                value={pinEmpleado} 
                onChange={e => setPinEmpleado(e.target.value)} 
                onKeyDown={(e) => { if(e.key === 'Enter') { setPasoManual(3); setLecturaLista(true); setTimeout(() => pinAutRef.current?.focus(), 200); }}} 
              />
            )}

            {(lecturaLista || (modo === 'manual' && pasoManual === 3)) && (
              <input 
                ref={pinAutRef} 
                type="text" 
                placeholder="PIN ADMINISTRADOR" 
                className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500 outline-none shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                value={pinAutorizador} 
                onChange={e => setPinAutorizador(e.target.value)} 
                onKeyDown={(e) => { if(e.key === 'Enter') registrarAcceso(); }} 
              />
            )}

            <button 
              onClick={registrarAcceso} 
              disabled={animar || !qrData || !pinAutorizador} 
              className="w-full py-6 bg-blue-600 rounded-3xl font-black uppercase italic shadow-lg hover:bg-blue-500 transition-all disabled:opacity-30"
            >
              {animar ? 'PROCESANDO...' : 'Confirmar'}
            </button>
            <button 
              onClick={volverAtras} 
              className="w-full text-center text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors"
            >
              ← Cancelar Lectura
            </button>
          </div>
        )}
      </div>
      <style jsx global>{`
        @keyframes scan-laser { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
      `}</style>
    </main>
  );
}