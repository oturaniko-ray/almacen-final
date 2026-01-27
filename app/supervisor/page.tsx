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
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    // 1. Validar Sesión y Obtener Datos
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);

    // 2. Lógica de Inactividad (2 Minutos)
    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.clear(); 
        router.replace('/'); 
      }, 120000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    resetTimer();

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [router]);

  useEffect(() => {
    if (modo === 'camara' && !lecturaLista) {
      const startScanner = async () => {
        try {
          scannerRef.current = new Html5Qrcode("reader");
          await scannerRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (decodedText) => {
              setQrData(decodedText);
              setLecturaLista(true);
              scannerRef.current?.stop();
            },
            () => {}
          );
        } catch (err) {
          console.error(err);
        }
      };
      startScanner();
    }

    if (modo === 'usb' && !lecturaLista) {
      const handleUSBScan = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          setLecturaLista(true);
        } else {
          setQrData(prev => prev + e.key);
        }
      };
      window.addEventListener('keypress', handleUSBScan);
      return () => window.removeEventListener('keypress', handleUSBScan);
    }
  }, [modo, lecturaLista]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
        if (dist > RADIO_MAXIMO_METROS) throw new Error(`FUERA DE RANGO (${Math.round(dist)}m)`);

        const idFinal = qrData.trim();
        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${idFinal},email.eq.${idFinal}`).maybeSingle();
        if (!emp) throw new Error("Empleado no encontrado");

        const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
        if (!aut) throw new Error("PIN de Autorización inválido");

        const ahora = new Date().toISOString();

        if (direccion === 'entrada') {
          await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: ahora, estado: 'activo' }]);
          await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
        } else {
          const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
          if (!jActiva) throw new Error("No tiene una jornada activa.");
          await supabase.from('jornadas').update({ hora_salida: ahora, estado: 'finalizado' }).eq('id', jActiva.id);
          await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
        }

        alert(`REGISTRO EXITOSO: ${emp.nombre}`);
        setModo('menu'); setDireccion(null); setQrData(''); setPinAutorizador(''); setLecturaLista(false);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setAnimar(false);
      }
    }, () => {
      alert("GPS OBLIGATORIO");
      setAnimar(false);
    });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative overflow-hidden">
        
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Panel de <span className="text-blue-500">Supervisión</span></h1>
          {user && (
            <div className="mt-4 flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Sesión Activa</span>
              <p className="text-xs font-bold text-white uppercase">{user.nombre} • <span className="text-blue-400">{user.rol}</span></p>
            </div>
          )}
        </header>

        {modo === 'menu' ? (
          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => { setModo('usb'); setDireccion('entrada'); }} className="group relative p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-[35px] hover:bg-emerald-500 transition-all text-left">
              <span className="text-3xl block mb-2">📥</span>
              <h3 className="font-black uppercase italic text-xl">Registrar Entrada</h3>
              <p className="text-[9px] font-bold text-emerald-500/60 group-hover:text-white uppercase tracking-widest">Escaneo de acceso</p>
            </button>
            <button onClick={() => { setModo('usb'); setDireccion('salida'); }} className="group relative p-8 bg-red-500/10 border border-red-500/20 rounded-[35px] hover:bg-red-500 transition-all text-left">
              <span className="text-3xl block mb-2">📤</span>
              <h3 className="font-black uppercase italic text-xl">Registrar Salida</h3>
              <p className="text-[9px] font-bold text-red-500/60 group-hover:text-white uppercase tracking-widest">Finalizar jornada</p>
            </button>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <button onClick={() => setModo('camara')} className="p-4 bg-white/5 rounded-[25px] font-black uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all">📷 Cámara</button>
              <button onClick={() => setModo('manual')} className="p-4 bg-white/5 rounded-[25px] font-black uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all">⌨️ Manual</button>
              <button onClick={() => router.push('/admin')} className="p-4 bg-white/5 rounded-[25px] font-black uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all">⚙️ Admin</button>
            </div>
            <button onClick={() => router.push('/')} className="mt-4 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] hover:text-white">← Salir al Inicio</button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Modo: {modo.toUpperCase()}</p>
                <h2 className="text-2xl font-black uppercase italic">{direccion || 'Identificar'}</h2>
              </div>
              <span className={`w-3 h-3 rounded-full ${lecturaLista ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 animate-pulse'}`}></span>
            </div>

            {modo === 'manual' && !lecturaLista ? (
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="DOCUMENTO O EMAIL" 
                  className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-xl font-black border-2 border-white/5 focus:border-blue-500 outline-none transition-all uppercase"
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => { setDireccion('entrada'); setLecturaLista(true); }} className="py-4 bg-emerald-600 rounded-[25px] font-black uppercase text-xs">Es Entrada</button>
                  <button onClick={() => { setDireccion('salida'); setLecturaLista(true); }} className="py-4 bg-red-600 rounded-[25px] font-black uppercase text-xs">Es Salida</button>
                </div>
              </div>
            ) : (
              <div className={`bg-[#050a14] rounded-[35px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative overflow-hidden h-48 flex flex-col items-center justify-center`}>
                {!lecturaLista ? (
                  <>
                    <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_15px_red] animate-laser z-20"></div>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && (
                      <div className="text-center">
                        <p className="text-[10px] font-black text-slate-500 animate-pulse uppercase tracking-widest">Esperando Escaneo USB...</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-emerald-500 font-black text-xs uppercase mb-1 tracking-widest">Identificado ✅</p>
                    <p className="text-white font-black text-xl uppercase italic break-all">{qrData}</p>
                  </div>
                )}
              </div>
            )}

            {lecturaLista && (
              <div className="space-y-4">
                <input 
                  ref={pinRef}
                  autoFocus
                  type="password" 
                  placeholder="PIN DE AUTORIZACIÓN" 
                  className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-4xl font-black border-2 border-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-800 tracking-widest"
                  value={pinAutorizador}
                  onChange={(e) => setPinAutorizador(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && registrarAcceso()}
                />
              </div>
            )}

            <button 
              onClick={registrarAcceso}
              disabled={animar || !qrData || !pinAutorizador}
              className="w-full py-8 bg-blue-600 rounded-[35px] font-black text-xl uppercase italic shadow-2xl shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-20 transition-all"
            >
              {animar ? 'PROCESANDO...' : `Confirmar ${direccion}`}
            </button>

            <button onClick={() => { setModo('menu'); setQrData(''); setLecturaLista(false); setPinAutorizador(''); setDireccion(null); }} className="mt-4 text-center w-full text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] hover:text-white transition-all">← Cancelar y Volver</button>
          </div>
        )}
      </div>
    </main>
  );
}