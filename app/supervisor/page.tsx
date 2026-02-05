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
  const [supervisorSesion, setSupervisorSesion] = useState<any>(null);
  const [config, setConfig] = useState<any>({ empresa_nombre: '', qr_expiracion: 30000, timer_inactividad: 120000 });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinEmpRef = useRef<HTMLInputElement>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const inputUsbRef = useRef<HTMLInputElement>(null);
  const docManualRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // --- SEGURIDAD: CONTROL DE INACTIVIDAD Y SESIÓN ÚNICA ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    
    const user = JSON.parse(sessionData);
    setSupervisorSesion(user);

    // Lógica de inactividad
    const tiempoLimite = config.timer_inactividad;
    const reiniciarTemporizador = () => {
      clearTimeout(window.inactividadSupTimeout);
      window.inactividadSupTimeout = setTimeout(() => {
        handleLogout();
      }, tiempoLimite);
    };

    const eventos = ['mousedown', 'mousemove', 'keypress', 'touchstart'];
    eventos.forEach(e => document.addEventListener(e, reiniciarTemporizador));
    reiniciarTemporizador();

    return () => {
      eventos.forEach(e => document.removeEventListener(e, reiniciarTemporizador));
      clearTimeout(window.inactividadSupTimeout);
    };
  }, [config.timer_inactividad]);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          empresa_nombre: cfgMap.empresa_nombre || 'SISTEMA',
          qr_expiracion: parseInt(cfgMap.qr_expiracion) || 30000,
          timer_inactividad: parseInt(cfgMap.timer_inactividad) || 120000
        });
      }
    };
    fetchConfig();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  const procesarLectura = (texto: string) => {
    try {
      const decoded = atob(texto);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        if (Date.now() - parseInt(timestamp) > config.qr_expiracion) {
          alert("❌ QR EXPIRADO");
          return '';
        }
        return docId;
      }
      return texto;
    } catch { return texto; }
  };

  const volverAtras = useCallback(async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    if (lecturaLista || qrData) {
      setQrData(''); setPinEmpleado(''); setPinAutorizador(''); setLecturaLista(false); setPasoManual(0);
      if (modo === 'camara') iniciarCamara();
      return;
    }
    setDireccion(null); setPasoManual(0);
  }, [lecturaLista, qrData, modo]);

  const iniciarCamara = async () => {
    try {
      setTimeout(async () => {
        if (!document.getElementById("reader")) return;
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, (decoded) => {
          const doc = procesarLectura(decoded);
          if (doc) { setQrData(doc); setLecturaLista(true); scanner.stop(); setTimeout(() => pinAutRef.current?.focus(), 300); }
        }, () => {});
      }, 300);
    } catch (err) { console.error(err); }
  };

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    try {
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq."${qrData}",email.eq."${qrData}"`).maybeSingle();
      if (!emp) throw new Error("Empleado no encontrado");
      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) throw new Error("PIN Incorrecto");
      
      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', String(pinAutorizador)).in('rol', ['supervisor', 'admin', 'Administrador']).maybeSingle();
      if (!aut) throw new Error("Autorizador no válido");

      const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

      if (direccion === 'entrada') {
        await supabase.from('jornadas').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          hora_entrada: new Date().toISOString(),
          autoriza: firma,
          estado: 'activo'
        }]);
        await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
      } else {
        const { data: j } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
        if (!j) throw new Error("No hay entrada activa");
        
        const hEntrada = new Date(j.hora_entrada).getTime();
        const hSalida = Date.now();
        const horas = parseFloat(((hSalida - hEntrada) / 3600000).toFixed(2));

        await supabase.from('jornadas').update({
          hora_salida: new Date().toISOString(),
          horas_trabajadas: horas,
          autoriza: firma,
          estado: 'finalizado'
        }).eq('id', j.id);
        await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
      }

      alert(`✅ ÉXITO: ${emp.nombre}`);
      setQrData(''); setLecturaLista(false); setPinAutorizador(''); setDireccion(null); setModo('menu');
    } catch (err: any) { alert(`❌ ${err.message}`); } finally { setAnimar(false); }
  };

  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA').split(' ');
    const lastWord = words.pop();
    return (
      <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-4">
        <span className="text-white">{words.join(' ')} </span>
        <span className="text-blue-700">{lastWord}</span>
      </h1>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative">
      
      {/* Membrete con fuentes +50% */}
      <div className="w-full max-w-lg bg-[#1a1a1a] p-10 rounded-[40px] border border-white/5 mb-6 text-center shadow-2xl">
        {renderBicolorTitle(config.empresa_nombre)}
        <p className="text-white font-bold text-[24px] uppercase tracking-[0.3em] mb-4">Panel de lectura QR</p>
        {supervisorSesion && (
          <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
            <span className="text-xl text-white uppercase font-bold">{supervisorSesion.nombre}</span>
            <span className="text-sm text-white/40 uppercase tracking-widest">{supervisorSesion.rol} ({supervisorSesion.nivel_acceso})</span>
          </div>
        )}
      </div>

      <div className="w-full max-w-lg bg-[#111111] p-10 rounded-[50px] border border-white/5 shadow-2xl">
        {modo === 'menu' ? (
          <div className="grid gap-4 w-full">
            <button onClick={() => setModo('usb')} className="w-full bg-blue-600 p-8 rounded-3xl text-white font-black uppercase italic text-lg shadow-xl active:scale-95 transition-all">🔌 SCANNER USB</button>
            <button onClick={() => setModo('camara')} className="w-full bg-emerald-600 p-8 rounded-3xl text-white font-black uppercase italic text-lg shadow-xl active:scale-95 transition-all">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 p-8 rounded-3xl text-white font-black uppercase italic text-lg border border-white/10 active:scale-95 transition-all">🖋️ MANUAL</button>
            <button onClick={handleLogout} className="mt-6 text-emerald-500 font-bold uppercase text-xs tracking-widest text-center italic">← Volver al menú anterior</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6 w-full">
            <button onClick={() => setDireccion('entrada')} className="w-full py-16 bg-emerald-600 rounded-[40px] font-black text-5xl italic hover:bg-emerald-500 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-16 bg-red-600 rounded-[40px] font-black text-5xl italic hover:bg-red-500 transition-all">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-6 text-slate-500 font-bold text-sm uppercase text-center tracking-widest">← Volver al menú anterior</button>
          </div>
        ) : (
          <div className="space-y-6 w-full">
            <div className={`bg-[#050a14] p-6 rounded-[40px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-72 flex items-center justify-center overflow-hidden relative`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && (
                      <input ref={inputUsbRef} type="text" className="bg-transparent text-center text-2xl font-black text-blue-500 outline-none w-full uppercase" placeholder="ESPERANDO USB..." autoFocus onChange={e => { setQrData(procesarLectura(e.target.value)); setLecturaLista(true); setTimeout(() => pinAutRef.current?.focus(), 200); }} />
                    )}
                    {modo === 'manual' && (
                      <input ref={docManualRef} type="text" placeholder="DOCUMENTO" className="bg-transparent text-center text-3xl font-black uppercase outline-none w-full text-white" value={qrData} onChange={e => setQrData(e.target.value)} onKeyDown={e => e.key === 'Enter' && setPasoManual(2)} />
                    )}
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_20px_red] animate-scan-laser"></div>
                  </>
                ) : <p className="text-emerald-500 font-black text-3xl uppercase italic">ID VALIDADO ✅</p>}
            </div>

            {lecturaLista && (
              <input ref={pinAutRef} type="password" placeholder="PIN AUTORIZADOR" className="w-full py-6 bg-[#050a14] rounded-3xl text-center text-4xl font-black border-4 border-blue-600 outline-none text-white tracking-[0.5em] shadow-blue-900/20 shadow-2xl" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarAcceso()} />
            )}

            <button onClick={registrarAcceso} disabled={!pinAutorizador || animar} className="w-full py-8 bg-blue-600 rounded-3xl font-black text-2xl uppercase italic shadow-2xl active:scale-95 transition-all">
              {animar ? '...' : 'CONFIRMAR'}
            </button>
            <button onClick={volverAtras} className="w-full text-center text-slate-500 font-bold uppercase text-xs tracking-widest italic">← Volver al menú anterior</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
      `}</style>
    </main>
  );
}

declare global { interface Window { inactividadSupTimeout: any; } }