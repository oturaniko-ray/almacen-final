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
  const [supervisorSesion, setSupervisorSesion] = useState<{nombre: string, rol: string} | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputUsbRef = useRef<HTMLInputElement>(null);
  const pinEmpRef = useRef<HTMLInputElement>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef(''); // Buffer para escáner USB
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setSupervisorSesion(JSON.parse(sessionData));
  }, []);

  // DECODIFICACIÓN SEGÚN EMPLEADOPAGE
  const procesarLectura = (texto: string) => {
    try {
      const decoded = atob(texto);
      return decoded.includes('|') ? decoded.split('|')[0] : texto;
    } catch { return texto; }
  };

  // MANEJO DE ESCÁNER USB (Evita que lea un solo carácter)
  const handleUsbKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const finalData = procesarLectura(bufferRef.current);
      setQrData(finalData);
      setLecturaLista(true);
      bufferRef.current = '';
      setTimeout(() => pinAutRef.current?.focus(), 200);
    } else {
      if (e.key.length === 1) bufferRef.current += e.key;
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
    bufferRef.current = '';
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
            setQrData(procesarLectura(decodedText));
            setLecturaLista(true);
            scanner.stop();
            setTimeout(() => pinAutRef.current?.focus(), 200);
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
      // 1. Validar Empleado
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${qrData},email.eq.${qrData}`).maybeSingle();
      if (!emp) throw new Error("Empleado no existe");
      if (modo === 'manual' && emp.pin_seguridad !== pinEmpleado) throw new Error("PIN Empleado incorrecto");
      
      // 2. Validar Autorizador
      const rolesReq = modo === 'manual' ? ['admin', 'administrador'] : ['supervisor', 'admin', 'administrador'];
      const { data: val } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', rolesReq).maybeSingle();
      if (!val) throw new Error(modo === 'manual' ? "Requiere PIN Admin" : "PIN Autorizador incorrecto");

      const firma = `${val.nombre} (${modo.toUpperCase()})`;

      if (direccion === 'entrada') {
        const { error: insErr } = await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, 
          documento_id: emp.documento_id,
          nombre_empleado: emp.nombre,
          hora_entrada: new Date().toISOString(), 
          autoriza_entrada: firma,
          estado: 'activo' 
        }]);
        if (insErr) throw insErr;
        await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
      } else {
        const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
        if (!jActiva) throw new Error("Sin entrada activa");

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

      alert(`✅ Registro OK: ${emp.nombre}`);
      resetLectura();
    } catch (err: any) { 
      alert(`❌ ${err.message}`); 
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 italic">Panel Supervisor</h2>
          {modo !== 'menu' && <p className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">{modo} | {supervisorSesion?.nombre}</p>}
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-blue-600 transition-all border border-white/5">🔌 Scanner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-emerald-600 transition-all border border-white/5">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-slate-700 transition-all border border-white/5">🖋️ Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="py-12 bg-emerald-600 rounded-[35px] font-black text-4xl italic">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-12 bg-red-600 rounded-[35px] font-black text-4xl italic">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-[10px] text-slate-500 uppercase text-center">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`bg-[#050a14] p-4 rounded-[30px] border ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} h-56 flex items-center justify-center relative overflow-hidden`}>
              {!lecturaLista ? (
                <>
                  {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                  {modo === 'usb' && (
                    <div className="text-center">
                      <p className="text-blue-500 font-black animate-pulse text-xs uppercase">Pase el código por el escáner...</p>
                      <input ref={inputUsbRef} type="text" className="opacity-0 absolute" onKeyDown={handleUsbKeyDown} autoFocus />
                    </div>
                  )}
                  {modo === 'manual' && (
                    <input type="text" placeholder="DOCUMENTO" className="bg-transparent text-center text-xl font-black outline-none w-full" autoFocus onKeyDown={(e) => { if(e.key === 'Enter') { setQrData(e.currentTarget.value); setTimeout(() => pinEmpRef.current?.focus(), 200); }}} />
                  )}
                  {modo !== 'manual' && <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-laser"></div>}
                </>
              ) : (
                <p className="text-emerald-500 font-black text-xl italic uppercase">ID: {qrData}</p>
              )}
            </div>

            {modo === 'manual' && qrData && !lecturaLista && (
              <input ref={pinEmpRef} type="password" placeholder="PIN EMPLEADO" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/10 outline-none" value={pinEmpleado} onChange={e => setPinEmpleado(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') setLecturaLista(true); }} />
            )}

            {lecturaLista && (
              <input ref={pinAutRef} type="password" placeholder="PIN AUTORIZADOR" className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500 outline-none" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') registrarAcceso(); }} />
            )}

            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-3xl font-black uppercase italic shadow-lg hover:bg-blue-500 disabled:opacity-30">
              {animar ? 'PROCESANDO...' : 'Confirmar'}
            </button>
            <button onClick={resetLectura} className="w-full text-center text-slate-500 uppercase text-[10px]">✕ Cancelar</button>
          </div>
        )}
      </div>
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
        .animate-laser { animation: laser 2s infinite linear; }
      `}</style>
    </main>
  );
}