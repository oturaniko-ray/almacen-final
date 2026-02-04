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
  const [datosSupervisor, setDatosSupervisor] = useState<{nombre: string, nivel: string} | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ALGORITMO DE DESCIFRADO SINCRONIZADO CON EMPLEADOPAGE
  const procesarLecturaQR = (textoLeido: string) => {
    try {
      // Intenta decodificar el Base64 (formato: documento|timestamp)
      const decoded = atob(textoLeido);
      if (decoded.includes('|')) {
        return decoded.split('|')[0]; // Extrae solo el documento_id
      }
      return textoLeido;
    } catch (e) {
      // Si falla atob, es una lectura directa (Scanner USB sin Base64)
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
            setQrData(procesarLecturaQR(decodedText));
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

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    try {
      // VALIDACIÓN DE EMPLEADO USANDO EL ID EXTRAÍDO
      const { data: emp } = await supabase.from('empleados')
        .select('*')
        .or(`documento_id.eq.${qrData},email.eq.${qrData}`)
        .maybeSingle();

      if (!emp) throw new Error("Empleado no existe en la base de datos");
      
      // VALIDACIÓN DE ROLES SEGÚN MODO (Manual requiere Admin)
      const rolesPermitidos = modo === 'manual' ? ['admin', 'administrador'] : ['supervisor', 'admin', 'administrador'];
      const { data: aut } = await supabase.from('empleados')
        .select('nombre, nivel_acceso')
        .eq('pin_seguridad', pinAutorizador)
        .in('rol', rolesPermitidos)
        .maybeSingle();

      if (!aut) throw new Error(modo === 'manual' ? "Requiere PIN de Administrador" : "PIN Incorrecto");

      setDatosSupervisor({ nombre: aut.nombre, nivel: aut.nivel_acceso || 'S/N' });

      const { data: jActiva } = await supabase.from('jornadas')
        .select('*')
        .eq('empleado_id', emp.id)
        .is('hora_salida', null)
        .maybeSingle();

      const firmaCompleta = `${aut.nombre} (${modo.toUpperCase()})`;

      if (direccion === 'entrada') {
        if (jActiva) throw new Error("Entrada ya activa");
        await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, nombre_empleado: emp.nombre, documento_id: emp.documento_id,
          hora_entrada: new Date().toISOString(), autoriza_entrada: firmaCompleta, estado: 'activo' 
        }]);
        await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
      } else {
        if (!jActiva) throw new Error("No hay entrada activa");
        const ahora = new Date();
        const diffMs = ahora.getTime() - new Date(jActiva.hora_entrada).getTime();
        const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
        
        await supabase.from('jornadas').update({ 
          hora_salida: ahora.toISOString(), horas_trabajadas: `${h}:${m}:${s}`, 
          autoriza_salida: firmaCompleta, estado: 'finalizado'
        }).eq('id', jActiva.id);
        await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
      }

      alert(`✅ Registro OK: ${emp.nombre}`);
      resetLectura();
    } catch (err: any) { 
      alert(`❌ ${err.message}`); 
      setAnimar(false);
      setLecturaLista(false);
      if (modo === 'camara') iniciarCamara();
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative">
        
        {/* MEMBRETE DINÁMICO CON MODO Y DATOS DE SUPERVISOR */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 tracking-tighter">
            {modo === 'menu' ? 'Panel Supervisor' : `Acceso: ${modo === 'usb' ? 'Scanner / USB' : modo === 'camara' ? 'Cámara Móvil' : 'Manual'}`}
          </h2>
          {modo !== 'menu' && (
            <div className="mt-2 space-y-1">
              {datosSupervisor && (
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  Autoriza: {datosSupervisor.nombre} (Nivel {datosSupervisor.nivel})
                </p>
              )}
              <p className="text-[9px] font-bold text-slate-500 uppercase">
                🛰️ {gpsReal.lat.toFixed(4)}, {gpsReal.lon.toFixed(4)}
              </p>
            </div>
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
          <div className="space-y-6">
            {modo === 'manual' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-2xl">
                <p className="text-[10px] text-yellow-500 font-black uppercase tracking-tighter leading-tight text-center">
                  ⚠️ ADVERTENCIA: Acceso Manual requiere validación física de un ADMINISTRADOR.
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
                    <input type="text" placeholder="DOCUMENTO O CORREO" className="bg-transparent text-center text-xl font-black uppercase outline-none w-full" autoFocus onKeyDown={(e) => { if(e.key === 'Enter') { setQrData(e.currentTarget.value); setLecturaLista(true); setTimeout(() => pinRef.current?.focus(), 300); }}} />
                  )}
                  {modo !== 'manual' && (
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <p className="text-emerald-500 font-black text-xl uppercase italic">ID Listo ✅</p>
                  <p className="text-[10px] text-slate-500 mt-2">{qrData}</p>
                </div>
              )}
            </div>

            {lecturaLista && (
              <input 
                ref={pinRef} 
                type="password" 
                placeholder="PIN AUTORIZADOR" 
                className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500 outline-none" 
                value={pinAutorizador} 
                onChange={e => setPinAutorizador(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter') registrarAcceso(); }} 
              />
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