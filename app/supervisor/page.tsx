'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONSTANTES DE SEGURIDAD
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; 
const TIEMPO_MAX_TOKEN_MS = 120000; // 2 min

export default function SupervisorPage() {
  const [user, setUser] = useState<any>(null);
  const [modo, setModo] = useState<'menu' | 'camara' | 'manual'>('menu');
  const [qrData, setQrData] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    setUser(JSON.parse(sessionData));

    return () => { stopScanner(); };
  }, [router]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    setModo('camara');
    setLecturaLista(false);
    setTimeout(() => {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          setQrData(text);
          setLecturaLista(true);
          stopScanner();
        },
        undefined
      );
    }, 100);
  };

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador) return;
    setAnimar(true);

    try {
      // 1. Validar PIN del Supervisor
      if (pinAutorizador !== user.pin_seguridad) {
        alert("PIN DE SUPERVISOR INCORRECTO");
        setAnimar(false);
        return;
      }

      // 2. Decodificar Token del Empleado
      const rawData = JSON.parse(atob(qrData));
      const { id: empleadoId, ts: timestamp } = rawData;

      // 3. Validar Expiración (Seguridad temporal)
      if (Date.now() - timestamp > TIEMPO_MAX_TOKEN_MS) {
        alert("CÓDIGO QR EXPIRADO");
        setAnimar(false);
        return;
      }

      // 4. Obtener datos del empleado
      const { data: emp, error: errEmp } = await supabase
        .from('empleados')
        .select('*')
        .eq('id', empleadoId)
        .single();

      if (!emp || !emp.activo) {
        alert("EMPLEADO INEXISTENTE O INACTIVO");
        setAnimar(false);
        return;
      }

      const nuevoEstado = !emp.en_almacen;
      const tipoMov = nuevoEstado ? 'entrada' : 'salida';

      // 5. Registrar Movimiento y Actualizar Estado
      await supabase.from('movimientos_acceso').insert([{
        empleado_id: empleadoId,
        nombre_empleado: emp.nombre,
        tipo_movimiento: tipoMov,
        autorizado_por: user.nombre,
        detalles: { modo_escaneo: modo, terminal: 'Mobile_Supervisor' }
      }]);

      await supabase.from('empleados').update({ en_almacen: nuevoEstado }).eq('id', empleadoId);

      alert(`REGISTRO EXITOSO: ${emp.nombre} -> ${tipoMov.toUpperCase()}`);
      setModo('menu');
      setQrData('');
      setPinAutorizador('');
      setLecturaLista(false);

    } catch (err) {
      alert("ERROR AL PROCESAR QR: Formato no válido");
    } finally {
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-md">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            PANEL <span className="text-blue-500">SUPERVISOR</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">
            VALIDACIÓN DE IDENTIDAD
          </p>
        </header>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={startScanner} className="w-full bg-[#0f172a] hover:bg-blue-600 p-8 rounded-[35px] border border-white/5 transition-all flex flex-col items-center">
              <span className="text-3xl mb-2">📷</span>
              <span className="font-black uppercase text-xs tracking-widest">ESCANEAR CÓDIGO QR</span>
            </button>
            <button onClick={() => setModo('manual')} className="w-full bg-[#0f172a] hover:bg-slate-700 p-8 rounded-[35px] border border-white/5 transition-all flex flex-col items-center">
              <span className="text-3xl mb-2">⌨️</span>
              <span className="font-black uppercase text-xs tracking-widest">INGRESO MANUAL</span>
            </button>
            <button onClick={() => router.push('/')} className="w-full py-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">← VOLVER AL INICIO</button>
          </div>
        ) : (
          <div className="bg-[#0f172a] p-8 rounded-[45px] border border-white/5 space-y-6 shadow-2xl relative overflow-hidden">
            {modo === 'camara' && !lecturaLista && (
              <div className="relative">
                <div id="reader" className="overflow-hidden rounded-3xl border-2 border-blue-500/20 h-64 bg-black"></div>
                <div className="absolute inset-x-0 h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-pulse top-1/2"></div>
              </div>
            )}

            {modo === 'manual' && !lecturaLista && (
              <div className="space-y-4">
                <label className="text-[10px] font-black text-blue-500 uppercase ml-4">PEGAR TOKEN QR</label>
                <textarea 
                  className="w-full bg-[#050a14] p-5 rounded-[22px] border border-white/10 font-mono text-[10px] outline-none h-32"
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  placeholder="Token base64..."
                />
                <button onClick={() => setLecturaLista(true)} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-xs">VALIDAR LECTURA</button>
              </div>
            )}

            {lecturaLista && (
              <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="text-center p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <p className="text-emerald-500 font-black text-[10px] uppercase">✓ CÓDIGO DETECTADO</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-blue-500 uppercase ml-4">CONFIRMAR CON TU PIN</label>
                  <input 
                    type="password" 
                    className="w-full bg-[#050a14] p-5 rounded-[25px] border border-white/10 text-center text-3xl font-black outline-none focus:border-blue-500" 
                    value={pinAutorizador}
                    onChange={(e) => setPinAutorizador(e.target.value)}
                    autoFocus
                  />
                </div>
                <button 
                  onClick={registrarAcceso} 
                  disabled={animar || !pinAutorizador} 
                  className="w-full bg-blue-600 py-6 rounded-[30px] font-black text-xl uppercase shadow-lg hover:bg-blue-500 transition-all disabled:opacity-30"
                >
                  {animar ? 'PROCESANDO...' : 'REGISTRAR'}
                </button>
              </div>
            )}

            <button onClick={() => { stopScanner(); setModo('menu'); }} className="w-full text-[10px] font-black uppercase text-slate-500 tracking-widest mt-4">CANCELAR</button>
          </div>
        )}
      </div>
    </main>
  );
}