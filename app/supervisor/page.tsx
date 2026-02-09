'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; 
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SupervisorPage() {
  const [modo, setModo] = useState<'scanner' | 'manual' | null>(null);
  const [qrData, setQrData] = useState('');
  const [idEmpleado, setIdEmpleado] = useState('');
  const [pinEmpleado, setPinEmpleado] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState('');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => alert("ERROR: GPS OBLIGATORIO PARA ESTE MÓDULO")
    );
  }, []);

  const iniciarScanner = useCallback(async () => {
    if (scannerRef.current) return;
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          // CORRECCIÓN QUIRÚRGICA: NORMALIZACIÓN DE LECTURA DE SCANNER
          setQrData(text.trim().toUpperCase());
          setLecturaLista(true);
          setAnimar(true);
          scanner.stop();
        },
        undefined
      );
    } catch (e) { console.error(e); }
  }, []);

  const resetLectura = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setQrData('');
    setIdEmpleado('');
    setPinEmpleado('');
    setPinAutorizador('');
    setLecturaLista(false);
    setModo(null);
    setAnimar(false);
  };

  const registrarAcceso = async () => {
    if (!pinAutorizador) return;

    // DETERMINAR ID A BUSCAR Y NORMALIZAR
    const finalID = (modo === 'manual' ? idEmpleado : qrData).trim().toUpperCase();

    try {
      // 1. VALIDAR EMPLEADO
      const { data: empleado, error: e1 } = await supabase
        .from('empleados')
        .select('*')
        .eq('documento_id', finalID)
        .single();

      if (e1 || !empleado) throw new Error("ID NO REGISTRADO");
      if (empleado.pin_seguridad !== pinEmpleado && modo === 'manual') throw new Error("PIN EMPLEADO INCORRECTO");

      // 2. VALIDAR SUPERVISOR (PIN)
      const { data: supervisor, error: e2 } = await supabase
        .from('empleados')
        .select('*')
        .eq('pin_seguridad', pinAutorizador)
        .in('rol', ['supervisor', 'admin'])
        .single();

      if (e2 || !supervisor) throw new Error("PIN SUPERVISOR INVÁLIDO");

      // 3. REGISTRAR ASISTENCIA
      const { error: e3 } = await supabase.from('asistencias').insert([{
        empleado_id: empleado.id,
        supervisor_id: supervisor.id,
        tipo: direccion,
        latitud: coords?.lat,
        longitud: coords?.lng,
        metodo: modo
      }]);

      if (e3) throw e3;

      alert(`${direccion?.toUpperCase()} REGISTRADA: ${empleado.nombre}`);
      resetLectura();
    } catch (err: any) {
      alert(err.message);
      // REQUISITO PROTOCOLO SENIOR: VUELVE AL FOCO INICIAL EN CASO DE ERROR
      setPinAutorizador('');
      if(modo === 'manual') setIdEmpleado('');
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-slate-200">
      <div className="w-full max-w-md bg-[#0f172a] rounded-[40px] border border-white/5 shadow-2xl p-8 relative overflow-hidden">
        {!direccion ? (
          <div className="space-y-6">
            <h1 className="text-3xl font-black italic text-white text-center uppercase tracking-tighter">CENTRO DE <span className="text-blue-500 font-black">CONTROL</span></h1>
            <button onClick={() => setDireccion('entrada')} className="w-full py-8 bg-blue-600 rounded-[24px] font-black text-2xl uppercase italic shadow-lg shadow-blue-900/40 active:scale-95 transition-all">Entrada</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-8 bg-rose-600/10 border border-rose-600/20 text-rose-500 rounded-[24px] font-black text-2xl uppercase italic active:scale-95 transition-all">Salida</button>
          </div>
        ) : !modo ? (
          <div className="space-y-6">
            <p className="text-center font-black text-blue-500 text-[10px] uppercase tracking-[0.3em]">Seleccione Método para {direccion}</p>
            <button onClick={() => { setModo('scanner'); iniciarScanner(); }} className="w-full py-8 bg-white text-black rounded-[24px] font-black text-xl uppercase italic active:scale-95 transition-all">Escanear QR</button>
            <button onClick={() => setModo('manual')} className="w-full py-8 bg-white/5 border border-white/10 text-white rounded-[24px] font-black text-xl uppercase italic active:scale-95 transition-all">Ingreso Manual</button>
            <button onClick={() => setDireccion(null)} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic">← REGRESAR</button>
          </div>
        ) : (
          <div className="space-y-6">
            {modo === 'scanner' && (
              <div className="relative">
                <div id="reader" className="overflow-hidden rounded-3xl border-4 border-white/10" />
                <div className="absolute inset-0 pointer-events-none border-[20px] border-[#0f172a]" />
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-laser" />
              </div>
            )}

            {modo === 'manual' && (
              <div className="space-y-4">
                <input type="text" placeholder="ID EMPLEADO" className="w-full py-4 bg-black rounded-2xl text-center text-2xl font-black border-2 border-white/10 text-white outline-none" value={idEmpleado} onChange={e => setIdEmpleado(e.target.value)} autoFocus />
                <input type="password" placeholder="PIN" className="w-full py-4 bg-black rounded-2xl text-center text-2xl font-black border-2 border-white/10 text-white outline-none" value={pinEmpleado} onChange={e => setPinEmpleado(e.target.value)} />
              </div>
            )}

            {(lecturaLista || (modo === 'manual' && idEmpleado && pinEmpleado)) && (
              <input type="password" placeholder="PIN SUPERVISOR" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border-4 border-blue-600 text-white outline-none" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarAcceso()} autoFocus />
            )}
            
            <button onClick={registrarAcceso} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic active:scale-95 transition-all">{animar ? 'PROCESANDO...' : 'CONFIRMAR OPERACIÓN'}</button>
            <button onClick={() => { setDireccion(null); resetLectura(); }} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic">← CANCELAR Y VOLVER</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite ease-in-out; }
      `}</style>
    </main>
  );
}