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
  const [gpsReal, setGpsReal] = useState({ lat: 0, lon: 0 });
  const [supervisorSesion, setSupervisorSesion] = useState<{nombre: string, rol: string} | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinEmpRef = useRef<HTMLInputElement>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setSupervisorSesion(JSON.parse(sessionData));
  }, []);

  const procesarLecturaQR = (textoLeido: string) => {
    try {
      const decoded = atob(textoLeido);
      if (decoded.includes('|')) return decoded.split('|')[0];
      return textoLeido;
    } catch (e) {
      return textoLeido;
    }
  };

  const resetLectura = useCallback(async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData('');
    setPinEmpleado('');
    setPinAutorizador('');
    setLecturaLista(false);
    setAnimar(false);
    setDireccion(null); 
  }, []);

  const volverAlMenu = () => {
    setDireccion(null);
    setModo('menu');
  };

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsReal({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
            setQrData(procesarLecturaQR(decodedText));
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
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, lecturaLista]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    try {
      // 1. Validar Empleado y su PIN
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${qrData},email.eq.${qrData}`).maybeSingle();
      if (!emp) throw new Error("Empleado no existe");
      if (modo === 'manual' && emp.pin_seguridad !== pinEmpleado) throw new Error("PIN de empleado incorrecto");
      
      // 2. Validar Autorizador
      const rolesRequeridos = modo === 'manual' ? ['admin', 'administrador'] : ['supervisor', 'admin', 'administrador'];
      const { data: validador } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', rolesRequeridos).maybeSingle();
      if (!validador) throw new Error(modo === 'manual' ? "Requiere PIN de ADMINISTRADOR" : "PIN Autorizador incorrecto");

      const firmaRegistro = `${validador.nombre} (${modo.toUpperCase()})`;

      // 3. Buscar jornada activa
      const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

      if (direccion === 'entrada') {
        if (jActiva) throw new Error("El empleado ya está presente");
        
        const { error: insErr } = await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, 
          nombre_empleado: emp.nombre, 
          documento_id: emp.documento_id,
          hora_entrada: new Date().toISOString(), 
          autoriza_entrada: firmaRegistro,
          estado: 'activo' 
        }]);
        if (insErr) throw insErr;
        await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);

      } else {
        if (!jActiva) throw new Error("No existe una entrada activa");
        
        const ahora = new Date();
        const entrada = new Date(jActiva.hora_entrada);
        const diffMs = ahora.getTime() - entrada.getTime();
        
        // CÁLCULO EN FORMATO TIEMPO HH:MM:SS
        const totalSegundos = Math.floor(diffMs / 1000);
        const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSegundos % 60).toString().padStart(2, '0');
        const tiempoFormateado = `${h}:${m}:${s}`;
        
        const { error: updErr } = await supabase.from('jornadas').update({ 
          hora_salida: ahora.toISOString(), 
          horas_trabajadas: tiempoFormateado, 
          autoriza_salida: firmaRegistro,
          estado: 'finalizado'
        }).eq('id', jActiva.id);
        if (updErr) throw updErr;
        await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
      }

      alert(`✅ Registro OK: ${emp.nombre}`);
      resetLectura();
    } catch (err: any) { 
      alert(`❌ ${err.message}`); 
      setAnimar(false);
      if (modo === 'camara' && !lecturaLista) iniciarCamara();
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 tracking-tighter">
            {modo === 'menu' ? 'Panel Supervisor' : `Acceso ${modo.toUpperCase()}`}
          </h2>
          {modo !== 'menu' && (
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">
              {supervisorSesion?.nombre} | GPS: {gpsReal.lat.toFixed(4)}, {gpsReal.lon.toFixed(4)}
            </p>
          )}
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase border border-white/5 hover:bg-blue-600 transition-all">🔌 Scanner / USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase border border-white/5 hover:bg-emerald-600 transition-all">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase border border-white/5 hover:bg-slate-700 transition-all">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-4 text-slate-600 font-bold uppercase text-[9px] text-center tracking-widest">← Salir</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl uppercase italic">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl uppercase italic">SALIDA</button>
            <button onClick={volverAlMenu} className="mt-6 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-4">
            {modo === 'manual' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-2xl mb-2 text-center">
                <p className="text-[9px] text-yellow-500 font-black uppercase">⚠️ PIN Administrador Requerido</p>
              </div>
            )}

            <div className={`bg-[#050a14] p-4 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative h-56 flex items-center justify-center overflow-hidden`}>
              {!lecturaLista ? (
                <>
                  {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                  {modo === 'usb' && (
                    <input type="text" className="opacity-0 absolute" autoFocus onChange={(e) => { setQrData(procesarLecturaQR(e.target.value)); setLecturaLista(true); setTimeout(() => pinAutRef.current?.focus(), 300); }} />
                  )}
                  {modo === 'manual' && (
                    <input type="text" placeholder="ID EMPLEADO" className="bg-transparent text-center text-xl font-black uppercase outline-none w-full" autoFocus onKeyDown={(e) => { if(e.key === 'Enter') { setQrData(e.currentTarget.value); setTimeout(() => pinEmpRef.current?.focus(), 100); }}} />
                  )}
                  {modo !== 'manual' && <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>}
                </>
              ) : (
                <div className="text-center font-black uppercase italic">
                  <p className="text-emerald-500 text-xl">ID: {qrData}</p>
                </div>
              )}
            </div>

            {modo === 'manual' && qrData && !lecturaLista && (
              <input ref={pinEmpRef} type="password" placeholder="PIN EMPLEADO" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/10 outline-none" value={pinEmpleado} onChange={e => setPinEmpleado(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') setLecturaLista(true); }} />
            )}

            {lecturaLista && (
              <input ref={pinAutRef} type="password" placeholder="PIN AUTORIZADOR" className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500 outline-none" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') registrarAcceso(); }} />
            )}

            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-3xl font-black uppercase italic shadow-lg hover:bg-blue-500 transition-all disabled:opacity-30">
              {animar ? 'PROCESANDO...' : 'Confirmar'}
            </button>
            <button onClick={resetLectura} className="w-full text-center text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">✕ Cancelar</button>
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