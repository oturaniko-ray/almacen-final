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
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | 'warning' | null }>({ texto: '', tipo: null });
  const [supervisorSesion, setSupervisorSesion] = useState<any>(null);
  const [config, setConfig] = useState<any>({ empresa_nombre: '', qr_expiracion: 30000, timer_inactividad: 120000 });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const inputUsbRef = useRef<HTMLInputElement>(null);
  const docManualRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // --- NOTIFICACIONES ESTILO EMPLEADO ---
  const showNotification = (texto: string, tipo: 'success' | 'error' | 'warning') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), tipo === 'warning' ? 3000 : 2000);
  };

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setSupervisorSesion(JSON.parse(sessionData));

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
  }, [router]);

  // --- ALGORITMO SINCRONIZADO CON EMPLEADOPAGE ---
  const procesarLectura = (texto: string) => {
    try {
      // El empleado genera btoa(documento_id + "|" + Date.now())
      const decoded = atob(texto);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        const ahora = Date.now();
        if (ahora - parseInt(timestamp) > config.qr_expiracion) {
          showNotification("CÓDIGO QR EXPIRADO", 'error');
          return '';
        }
        return docId; // Retorna el documento_id limpio
      }
      return texto; 
    } catch (e) {
      return texto; // Si no es base64 (USB/Manual), lo trata como texto plano
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  const volverAtras = useCallback(async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData(''); setPinEmpleado(''); setPinAutorizador(''); setLecturaLista(false);
    if (modo === 'camara' && direccion) iniciarCamara();
    else setDireccion(null);
  }, [modo, direccion]);

  const iniciarCamara = async () => {
    try {
      setTimeout(async () => {
        if (!document.getElementById("reader")) return;
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start({ facingMode: "environment" }, { fps: 25, qrbox: 250 }, (decoded) => {
          const doc = procesarLectura(decoded);
          if (doc) { 
            setQrData(doc); 
            setLecturaLista(true); 
            scanner.stop(); 
            setTimeout(() => pinAutRef.current?.focus(), 300); 
          }
        }, () => {});
      }, 300);
    } catch (err) { console.error(err); }
  };

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    const ahoraTimestamp = new Date().toISOString();

    try {
      // 1. VALIDAR EMPLEADO Y ESTATUS ACTIVO
      const { data: emp, error: empErr } = await supabase.from('empleados')
        .select('*')
        .or(`documento_id.eq."${qrData}",email.eq."${qrData}"`)
        .maybeSingle();

      if (!emp) throw new Error("Empleado no encontrado en base de datos");
      
      // REGLA DE ORO: Si no está activo, warning y reset
      if (emp.activo === false) {
        showNotification("EMPLEADO NO REGISTRADO COMO ACTIVO", 'warning');
        setTimeout(() => volverAtras(), 3000);
        return;
      }

      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) throw new Error("PIN de empleado incorrecto");

      // 2. VALIDAR AUTORIZADOR (Supervisor/Admin)
      const { data: aut } = await supabase.from('empleados')
        .select('nombre')
        .eq('pin_seguridad', String(pinAutorizador))
        .in('rol', ['supervisor', 'admin', 'Administrador'])
        .maybeSingle();

      if (!aut) throw new Error("PIN de autorizador no válido o sin permisos");

      const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

      if (direccion === 'entrada') {
        // REGISTRO ENTRADA
        await supabase.from('jornadas').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          hora_entrada: ahoraTimestamp,
          autoriza_entrada: firma,
          estado: 'activo'
        }]);

        await supabase.from('empleados').update({ 
          en_almacen: true,
          ultimo_ingreso: ahoraTimestamp 
        }).eq('id', emp.id);

      } else {
        // REGISTRO SALIDA
        const { data: j } = await supabase.from('jornadas')
          .select('*')
          .eq('empleado_id', emp.id)
          .is('hora_salida', null)
          .order('hora_entrada', { ascending: false })
          .maybeSingle();

        if (!j) throw new Error("No se detectó una entrada activa para este empleado");
        
        const hEntrada = new Date(j.hora_entrada).getTime();
        const hSalida = Date.now();
        const horas = parseFloat(((hSalida - hEntrada) / 3600000).toFixed(2));

        await supabase.from('jornadas').update({
          hora_salida: ahoraTimestamp,
          horas_trabajadas: horas,
          autoriza_salida: firma,
          estado: 'finalizado'
        }).eq('id', j.id);

        await supabase.from('empleados').update({ 
          en_almacen: false,
          ultima_salida: ahoraTimestamp 
        }).eq('id', emp.id);
      }

      showNotification(`REGISTRO EXITOSO: ${emp.nombre}`, 'success');
      setQrData(''); setLecturaLista(false); setPinAutorizador(''); setDireccion(null); setModo('menu');

    } catch (err: any) { 
      showNotification(err.message, 'error'); 
    } finally { 
      setAnimar(false); 
    }
  };

  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA').split(' ');
    const lastWord = words.pop();
    return (
      <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-2">
        <span className="text-white">{words.join(' ')} </span>
        <span className="text-blue-700">{lastWord}</span>
      </h1>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* NOTIFICACIÓN FLASH ESTILO EMPLEADO */}
      {mensaje.tipo && (
        <div className={`fixed top-10 z-[100] px-8 py-4 rounded-2xl font-black animate-bounce text-center shadow-2xl ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 
          mensaje.tipo === 'warning' ? 'bg-amber-500 text-black animate-flash-fast' : 'bg-rose-600 text-white'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* Membrete */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-8 rounded-[30px] border border-white/5 mb-4 text-center">
        {renderBicolorTitle(config.empresa_nombre)}
        <p className="text-white font-bold text-[19px] uppercase tracking-[0.25em] mb-4">Panel de lectura QR</p>
        {supervisorSesion && (
          <div className="pt-3 border-t border-white/10 flex flex-col gap-1">
            <span className="text-base text-white uppercase font-bold">{supervisorSesion.nombre}</span>
            <span className="text-[10px] text-white/40 uppercase tracking-widest">
              {supervisorSesion.rol} ({supervisorSesion.nivel_acceso})
            </span>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[40px] border border-white/5 shadow-2xl relative">
        {modo === 'menu' ? (
          <div className="grid gap-3 w-full">
            <button onClick={() => setModo('usb')} className="w-full bg-blue-600 p-6 rounded-2xl text-white font-black uppercase italic text-sm shadow-xl active:scale-95 transition-all">🔌 SCANNER USB</button>
            <button onClick={() => { setModo('camara'); setDireccion(null); }} className="w-full bg-emerald-600 p-6 rounded-2xl text-white font-black uppercase italic text-sm shadow-xl active:scale-95 transition-all">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 p-6 rounded-2xl text-white font-black uppercase italic text-sm border border-white/10 active:scale-95 transition-all">🖋️ MANUAL</button>
            <button onClick={handleLogout} className="mt-4 text-emerald-500 font-bold uppercase text-[9px] tracking-widest text-center italic">← Volver al menú anterior</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => setDireccion('entrada')} className="w-full py-8 bg-emerald-600 rounded-[30px] font-black text-4xl italic active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-8 bg-red-600 rounded-[30px] font-black text-4xl italic active:scale-95 transition-all">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← Volver al menú anterior</button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-60 flex items-center justify-center overflow-hidden relative`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && (
                      <input ref={inputUsbRef} type="text" className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full uppercase" placeholder="ESPERANDO USB..." autoFocus onChange={e => { 
                        const doc = procesarLectura(e.target.value);
                        if(doc) { setQrData(doc); setLecturaLista(true); setTimeout(() => pinAutRef.current?.focus(), 200); }
                      }} />
                    )}
                    {modo === 'manual' && (
                      <input ref={docManualRef} type="text" placeholder="DOCUMENTO" className="bg-transparent text-center text-2xl font-black uppercase outline-none w-full text-white" value={qrData} onChange={e => setQrData(e.target.value)} onKeyDown={e => e.key === 'Enter' && setLecturaLista(true)} />
                    )}
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>
                  </>
                ) : <p className="text-emerald-500 font-black text-2xl uppercase italic animate-pulse">ID VALIDADO ✅</p>}
            </div>

            {lecturaLista && (
              <input ref={pinAutRef} type="password" placeholder="PIN AUTORIZADOR" className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-3xl font-black border-4 border-blue-600 outline-none text-white tracking-[0.4em]" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarAcceso()} />
            )}

            <button onClick={registrarAcceso} disabled={!pinAutorizador || animar} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic shadow-2xl active:scale-95 transition-all">
              {animar ? 'PROCESANDO...' : 'CONFIRMAR'}
            </button>
            <button onClick={volverAtras} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic">← Volver al menú anterior</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
        @keyframes flash-fast { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-flash-fast { animation: flash-fast 0.5s infinite; }
      `}</style>
    </main>
  );
}