'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 COORDENADAS PROPORCIONADAS
const ALMACEN_LAT = 40.59680101005673; 
const ALMACEN_LON = -3.595251665548761;
const RADIO_MAXIMO_METROS = 80; 
const TIEMPO_MAX_TOKEN_MS = 120000;

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SupervisorPage() {
  const [user, setUser] = useState<any>(null);
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);

    const canalSesion = supabase.channel('supervisor-session-control');
    canalSesion
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.email === currentUser.email && payload.payload.id !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => { localStorage.removeItem('user_session'); router.push('/'); }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSesion.send({ type: 'broadcast', event: 'nueva-sesion', payload: { id: sessionId.current, email: currentUser.email } });
        }
      });
    return () => { supabase.removeChannel(canalSesion); };
  }, [router]);

  const volverAtras = async () => {
    try { if (scannerRef.current?.isScanning) { await scannerRef.current.stop(); scannerRef.current = null; } } catch (e) {}
    if (direccion) { setDireccion(null); setQrData(''); setPinAutorizador(''); setPinEmpleadoManual(''); setLecturaLista(false); } 
    else if (modo !== 'menu') { setModo('menu'); }
  };

  const prepararSiguienteEmpleado = () => {
    setQrData(''); setPinEmpleadoManual(''); setPinAutorizador(''); setLecturaLista(false); setAnimar(false);
    if (modo === 'manual') setTimeout(() => docInputRef.current?.focus(), 100);
    if (modo === 'camara') reiniciarCamara();
  };

  const reiniciarCamara = async () => {
    if (modo === 'camara' && direccion) {
      try {
        if (scannerRef.current?.isScanning) await scannerRef.current.stop();
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
          setQrData(text); setLecturaLista(true);
          scanner.stop().then(() => { scannerRef.current = null; });
          setTimeout(() => pinRef.current?.focus(), 200);
        }, () => {});
      } catch (err) {}
    }
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) { setQrData(buffer.trim()); setLecturaLista(true); setTimeout(() => pinRef.current?.focus(), 100); }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) { reiniciarCamara(); }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {}); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
        if (dist > RADIO_MAXIMO_METROS) {
          throw new Error(`FUERA DE RANGO: Estás a ${Math.round(dist)}m.`);
        }

        let idFinal = qrData.trim();
        if (modo !== 'manual') {
          try {
            const decoded = atob(idFinal).split('|');
            if (decoded.length === 2) {
              const [docId, timestamp] = decoded;
              if (Date.now() - parseInt(timestamp) > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN EXPIRADO");
              idFinal = docId;
            }
          } catch (e: any) {
            if (e.message === "TOKEN EXPIRADO") throw e;
          }
        }

        // 🔴 CAMBIO: Se ajusta la selección de columna de 'estado' a 'activo'
        const { data: emp, error: empError } = await supabase
          .from('empleados')
          .select('id, nombre, activo, pin_seguridad, documento_id, email')
          .or(`documento_id.eq.${idFinal},email.eq.${idFinal}`)
          .maybeSingle();

        if (empError || !emp) throw new Error(`Empleado no encontrado (ID: ${idFinal})`);
        
        // 🔴 CAMBIO: Validación sobre la columna 'activo' (boolean)
        if (emp.activo !== true) {
          throw new Error("Persona no tiene acceso a las instalaciones ya que no presta servicio en esta Empresa");
        }

        if (modo === 'manual' && emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN Empleado incorrecto");
        
        const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
        if (!aut) throw new Error("PIN Supervisor inválido");

        const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

        if (direccion === 'entrada') {
          if (jActiva) throw new Error("Ya tiene una entrada activa.");
          await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: new Date().toISOString(), estado: 'activo' }]);
          await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        } else {
          if (!jActiva) throw new Error("No hay entrada registrada.");
          const ahora = new Date();
          const horas = (ahora.getTime() - new Date(jActiva.hora_entrada).getTime()) / 3600000;
          await supabase.from('jornadas').update({ hora_salida: ahora.toISOString(), horas_trabajadas: horas, estado: 'finalizado', editado_por: `Aut: ${aut.nombre}` }).eq('id', jActiva.id);
          await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        }

        alert(`✅ Éxito: ${emp.nombre}`);
        prepararSiguienteEmpleado();
      } catch (err: any) { 
        alert(`❌ ${err.message}`); 
        prepararSiguienteEmpleado(); 
      }
    }, () => { alert("GPS Obligatorio"); prepararSiguienteEmpleado(); }, { enableHighAccuracy: true });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        .animate-laser { animation: laser 2s infinite linear; }
      `}</style>
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative z-10">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-1 text-center tracking-tighter">Panel de Supervisión</h2>
        {modo === 'menu' ? (
          <div className="grid gap-4 text-center">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all uppercase tracking-widest">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all uppercase tracking-widest">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-slate-400 transition-all uppercase tracking-widest">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-6 text-slate-500 font-bold uppercase text-[11px] tracking-[0.3em] hover:text-blue-400">← Volver al Inicio</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl">SALIDA</button>
            <button onClick={volverAtras} className="mt-4 text-slate-500 font-bold uppercase text-[10px] tracking-widest">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-6">
            {modo === 'manual' ? (
              <div className="space-y-6">
                <input ref={docInputRef} type="text" autoFocus className="w-full py-4 bg-[#050a14] rounded-[20px] text-center text-xl font-bold border border-white/10" placeholder="ID Empleado" value={qrData} onChange={(e) => setQrData(e.target.value)} />
                <input type="password" placeholder="PIN Personal" className="w-full py-4 bg-[#050a14] rounded-[20px] text-center text-xl font-black border border-white/10" value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)} />
                <input ref={pinRef} type="password" placeholder="PIN Administrador" className="w-full py-4 bg-[#050a14] rounded-[20px] text-center text-xl font-black border-2 border-blue-500/20" value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }} />
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative overflow-hidden h-32 flex flex-col items-center justify-center`}>
                  {!lecturaLista ? (
                    <>
                      <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-laser z-20"></div>
                      {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    </>
                  ) : <p className="text-emerald-500 font-black text-[9px] uppercase">Identificado ✅</p>}
                </div>
                {lecturaLista && <input ref={pinRef} type="password" placeholder="PIN Supervisor" className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-3xl font-black border-2 border-blue-500/10" value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }} />}
              </div>
            )}
            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-30">
              {animar ? 'PROCESANDO...' : 'Registrar'}
            </button>
            <button onClick={volverAtras} className="w-full text-center text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em]">✕ Cancelar</button>
          </div>
        )}
      </div>
    </main>
  );
}