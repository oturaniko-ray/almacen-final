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
  const [supervisorSesion, setSupervisorSesion] = useState<any>(null);
  const [config, setConfig] = useState<any>({ empresa_nombre: '', qr_expiracion: 30000 });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinEmpRef = useRef<HTMLInputElement>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const inputUsbRef = useRef<HTMLInputElement>(null);
  const docManualRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // --- CARGA DE CONFIGURACIÓN Y SESIÓN ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setSupervisorSesion(JSON.parse(sessionData));

    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          empresa_nombre: cfgMap.empresa_nombre || 'SISTEMA',
          qr_expiracion: parseInt(cfgMap.qr_expiracion) || 30000
        });
      }
    };
    fetchConfig();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsReal({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // --- ALGORITMO DE DECODIFICACIÓN QR (Sincronizado con EmpleadoPage) ---
  const procesarLectura = (texto: string) => {
    try {
      // Intentamos decodificar Base64
      const decoded = atob(texto);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        const ahora = Date.now();
        const antiguedad = ahora - parseInt(timestamp);

        // Validamos expiración según sistema_config
        if (antiguedad > config.qr_expiracion) {
          alert("❌ El código QR ha expirado. El empleado debe generar uno nuevo.");
          return '';
        }
        return docId; // Retornamos el documento extraído
      }
      return texto;
    } catch { 
      return texto; // Si no es Base64, lo toma como texto plano (USB/Manual)
    }
  };

  const volverAtras = useCallback(async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    if (lecturaLista || qrData) {
      setQrData('');
      setPinEmpleado('');
      setPinAutorizador('');
      setLecturaLista(false);
      setPasoManual(modo === 'manual' ? 1 : 0);
      if (modo === 'camara') iniciarCamara();
      return;
    }
    setDireccion(null);
    setPasoManual(0);
  }, [lecturaLista, qrData, modo]);

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
            const docExtraido = procesarLectura(decodedText);
            if (docExtraido) {
              setQrData(docExtraido);
              setLecturaLista(true);
              scanner.stop();
              setTimeout(() => pinAutRef.current?.focus(), 300);
            }
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
      
      const rolesReq = ['supervisor', 'admin', 'administrador'];
      const { data: val } = await supabase.from('empleados')
        .select('nombre')
        .eq('pin_seguridad', String(pinAutorizador))
        .in('rol', rolesReq)
        .maybeSingle();

      if (!val) throw new Error("PIN Autorizador no tiene permisos");

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
      resetLecturaTotal();
    }
  };

  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA').split(' ');
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return (
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{firstPart} </span>
        <span className="text-blue-700">{lastWord}</span>
      </h1>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* --- MEMBRETE ESTANDARIZADO --- */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] shadow-2xl border border-white/5 mb-4 text-center">
        {renderBicolorTitle(config.empresa_nombre)}
        
        {/* Título del módulo escalado */}
        <p className="text-white font-bold text-[17px] uppercase tracking-[0.25em] mb-3">
          Panel de lectura QR
        </p>

        {supervisorSesion && (
          <div className="mt-2 pt-2 border-t border-white/5 flex flex-col items-center gap-1">
            <span className="text-sm font-normal text-white uppercase">
              {supervisorSesion.nombre}
            </span>
            <span className="text-[11px] font-normal text-white/50 uppercase tracking-tighter">
              {supervisorSesion.rol} ({supervisorSesion.nivel_acceso || 'N/A'})
            </span>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5 shadow-2xl flex flex-col items-center">
        
        {modo === 'menu' ? (
          <div className="grid gap-3 w-full">
            <button onClick={() => setModo('usb')} className="w-full bg-blue-500 hover:bg-blue-600 p-5 rounded-xl text-white font-bold uppercase italic text-[11px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3">
              🔌 Scanner / USB
            </button>
            <button onClick={() => setModo('camara')} className="w-full bg-emerald-500 hover:bg-emerald-600 p-5 rounded-xl text-white font-bold uppercase italic text-[11px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3">
              📱 Cámara Móvil
            </button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 hover:bg-white/10 p-5 rounded-xl text-white font-bold uppercase italic text-[11px] border border-white/10 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3">
              🖋️ Entrada Manual
            </button>
            <button onClick={() => router.push('/')} className="mt-4 text-emerald-500 font-bold uppercase text-[9px] tracking-widest text-center italic">
              ← Salir del sistema
            </button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4 w-full">
             <div className="text-center mb-2">
                <p className="text-[14px] font-bold uppercase tracking-[0.4em] text-white animate-pulse-very-slow">
                  Selección
                </p>
             </div>
            <button onClick={() => setDireccion('entrada')} className="w-full py-10 bg-emerald-600 rounded-[30px] font-black text-3xl shadow-xl uppercase italic hover:bg-emerald-500 active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-10 bg-red-600 rounded-[30px] font-black text-3xl shadow-xl uppercase italic hover:bg-red-500 active:scale-95 transition-all">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest hover:text-white transition-colors">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {/* Lógica de lectura y inputs */}
            <div className={`bg-[#050a14] p-4 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative h-56 flex items-center justify-center overflow-hidden`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && (
                      <div className="text-center">
                        <p className="text-blue-500 font-black animate-pulse uppercase text-[10px] tracking-widest">Esperando lectura USB...</p>
                        <input ref={inputUsbRef} type="text" className="opacity-0 absolute" autoFocus onChange={(e) => { 
                             setQrData(procesarLectura(e.target.value));
                             setLecturaLista(true);
                             setTimeout(() => pinAutRef.current?.focus(), 200);
                        }} />
                      </div>
                    )}
                    {modo === 'manual' && (
                      <input ref={docManualRef} type="text" placeholder="DOCUMENTO / CORREO" className="bg-transparent text-center text-xl font-black uppercase outline-none w-full text-white" 
                        onKeyDown={(e) => { if(e.key === 'Enter') { setPasoManual(2); setTimeout(() => pinEmpRef.current?.focus(), 200); }}} 
                        value={qrData} onChange={(e) => setQrData(e.target.value)} />
                    )}
                    {modo !== 'manual' && <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>}
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-emerald-500 font-black text-xl uppercase italic">ID Validado ✅</p>
                    <p className="text-white/40 text-[9px] uppercase mt-2">{qrData}</p>
                  </div>
                )}
            </div>

            {modo === 'manual' && pasoManual >= 2 && (
              <input ref={pinEmpRef} type="password" placeholder="PIN EMPLEADO" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-xl font-black border border-white/10 outline-none text-white tracking-[0.3em]" 
                value={pinEmpleado} onChange={e => setPinEmpleado(e.target.value)} 
                onKeyDown={(e) => { if(e.key === 'Enter') { setPasoManual(3); setLecturaLista(true); setTimeout(() => pinAutRef.current?.focus(), 200); }}} 
              />
            )}

            {(lecturaLista || (modo === 'manual' && pasoManual === 3)) && (
              <input ref={pinAutRef} type="password" placeholder="PIN AUTORIZADOR" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-xl font-black border-2 border-blue-500 outline-none text-white tracking-[0.3em] shadow-[0_0_20px_rgba(59,130,246,0.2)]" 
                value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} 
                onKeyDown={(e) => { if(e.key === 'Enter') registrarAcceso(); }} 
              />
            )}

            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase italic shadow-lg hover:bg-blue-500 transition-all disabled:opacity-30 text-white">
              {animar ? 'PROCESANDO...' : 'Confirmar Registro'}
            </button>
            <button onClick={volverAtras} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:text-white transition-colors italic">
              ← Cancelar / Volver
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
        @keyframes pulse-very-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
        .animate-pulse-very-slow { animation: pulse-very-slow 6s ease-in-out infinite; }
      `}</style>
    </main>
  );
}