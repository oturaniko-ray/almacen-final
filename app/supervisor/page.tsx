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
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [gpsReal, setGpsReal] = useState({ lat: 0, lon: 0 });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Función para decodificar QR si viene con pipe (documento|timestamp)
  const procesarLecturaQR = (textoLeido: string) => {
    try {
      const decoded = atob(textoLeido);
      if (decoded.includes('|')) {
        const [documento] = decoded.split('|');
        return documento; 
      }
      return textoLeido;
    } catch (e) {
      return textoLeido; 
    }
  };

  const resetLectura = useCallback(async () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setQrData('');
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
            const documentoExtraido = procesarLecturaQR(decodedText);
            setQrData(documentoExtraido);
            setLecturaLista(true);
            scanner.stop();
            setTimeout(() => pinRef.current?.focus(), 300);
          },
          () => {}
        );
      }, 300);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      iniciarCamara();
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, lecturaLista]);

  // RUTINA AUDITADA Y CORREGIDA PARA REGISTRO EN TABLA JORNADAS
  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    try {
      // 1. Validar existencia del empleado
      const { data: emp, error: errEmp } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq.${qrData},email.eq.${qrData}`)
        .maybeSingle();
      
      if (errEmp || !emp) throw new Error("Empleado no registrado en el sistema");
      
      // 2. Validar PIN del Supervisor
      const { data: aut, error: errAut } = await supabase
        .from('empleados')
        .select('nombre')
        .eq('pin_seguridad', pinAutorizador)
        .in('rol', ['supervisor', 'admin', 'administrador'])
        .maybeSingle();
      
      if (errAut || !aut) throw new Error("PIN de Supervisor incorrecto o sin permisos");

      // 3. Buscar jornada activa (sin hora_salida)
      const { data: jActiva } = await supabase
        .from('jornadas')
        .select('*')
        .eq('empleado_id', emp.id)
        .is('hora_salida', null)
        .order('hora_entrada', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (direccion === 'entrada') {
        if (jActiva) throw new Error(`El empleado ya tiene una entrada activa (${new Date(jActiva.hora_entrada).toLocaleTimeString()})`);
        
        // Registrar Entrada
        const { error: insErr } = await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, 
          nombre_empleado: emp.nombre, 
          documento_id: emp.documento_id,
          hora_entrada: new Date().toISOString(), 
          estado: 'activo' 
        }]);
        if (insErr) throw insErr;

        // Actualizar estado del empleado para el módulo de Presencia
        await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);

      } else {
        if (!jActiva) throw new Error("No existe una entrada previa registrada para este empleado");
        
        // CÁLCULO DE TIEMPO EXACTO
        const ahora = new Date();
        const entrada = new Date(jActiva.hora_entrada);
        const diffMs = ahora.getTime() - entrada.getTime();
        const totalSegundos = Math.floor(diffMs / 1000);
        
        const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSegundos % 60).toString().padStart(2, '0');
        const tiempoFormateado = `${h}:${m}:${s}`;
        
        // Registrar Salida
        const { error: updErr } = await supabase.from('jornadas').update({ 
          hora_salida: ahora.toISOString(), 
          horas_trabajadas: tiempoFormateado, 
          estado: 'finalizado', 
          editado_por: `Supervisor: ${aut.nombre}` 
        }).eq('id', jActiva.id);
        if (updErr) throw updErr;

        // Actualizar estado del empleado para el módulo de Presencia
        await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
      }

      alert(`✅ Registro Exitoso: ${emp.nombre}`);
      resetLectura();
    } catch (err: any) { 
      alert(`❌ Error: ${err.message}`); 
      setAnimar(false);
      setLecturaLista(false);
      if (modo === 'camara') iniciarCamara();
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 tracking-tighter">Panel Supervisor</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">🛰️ GPS: {gpsReal.lat.toFixed(4)}, {gpsReal.lon.toFixed(4)}</p>
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
          <div className="space-y-6">
            {modo === 'manual' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-2xl">
                <p className="text-[10px] text-yellow-500 font-black uppercase tracking-tighter leading-tight text-center">
                  ⚠️ ADVERTENCIA: Se requiere la autorización de un administrador para poder dar acceso manual.
                </p>
              </div>
            )}
            <div className={`bg-[#050a14] p-4 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative h-64 flex items-center justify-center overflow-hidden`}>
              {!lecturaLista ? (
                <>
                  {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                  {modo === 'usb' && (
                    <div className="text-center">
                      <p className="text-blue-500 font-black animate-pulse uppercase">Esperando Scanner...</p>
                      <input type="text" className="opacity-0 absolute" autoFocus onChange={(e) => { 
                        setQrData(procesarLecturaQR(e.target.value)); 
                        setLecturaLista(true); 
                        setTimeout(() => pinRef.current?.focus(), 300); 
                      }} />
                    </div>
                  )}
                  {modo === 'manual' && (
                    <input type="text" placeholder="ID O CORREO" className="bg-transparent text-center text-xl font-black uppercase outline-none w-full" autoFocus onKeyDown={(e) => { if(e.key === 'Enter') { setQrData(e.currentTarget.value); setLecturaLista(true); setTimeout(() => pinRef.current?.focus(), 300); }}} />
                  )}
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-emerald-500 font-black text-xl uppercase italic">Identidad Lista ✅</p>
                  <p className="text-[10px] text-slate-500 mt-2">{qrData}</p>
                </div>
              )}
            </div>
            {lecturaLista && (
              <input ref={pinRef} type="password" placeholder="PIN SUPERVISOR" className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500 outline-none" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} />
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