'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONSTANTES 
const ALMACEN_LAT = 40.59682191301211; 
const ALMACEN_LON = -3.5952475579699485;
const RADIO_MAXIMO_METROS = 80; 
const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [user, setUser] = useState<any>(null);
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const router = useRouter();
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador', 'supervisor'].includes(currentUser.rol)) { router.replace('/'); return; }
    setUser(currentUser);

    const handleUSBScan = (e: KeyboardEvent) => {
      if (modo === 'usb' && !lecturaLista) {
        if (e.key === 'Enter') {
          setLecturaLista(true);
          setTimeout(() => pinRef.current?.focus(), 100);
        } else {
          setQrData(prev => prev + e.key);
        }
      }
    };
    window.addEventListener('keypress', handleUSBScan);
    return () => {
      window.removeEventListener('keypress', handleUSBScan);
      stopCamera();
    };
  }, [modo, lecturaLista, router]);

  const stopCamera = async () => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
      await html5QrCode.current.stop();
    }
  };

  const startCamera = async () => {
    if (!html5QrCode.current) html5QrCode.current = new Html5Qrcode("reader");
    html5QrCode.current.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        setQrData(decodedText);
        setLecturaLista(true);
        stopCamera();
        setTimeout(() => pinRef.current?.focus(), 100);
      },
      () => {}
    );
  };

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const prepararSiguienteEmpleado = () => {
    setQrData('');
    setPinEmpleadoManual('');
    setPinAutorizador('');
    setLecturaLista(false);
    setAnimar(false);
    if (modo === 'camara') startCamera();
  };

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const distancia = calcularDistancia(latitude, longitude, ALMACEN_LAT, ALMACEN_LON);

      try {
        if (distancia > RADIO_MAXIMO_METROS) {
          throw new Error(`ESTÁS FUERA DE RANGO (${Math.round(distancia)}m). ACÉRCATE AL ALMACÉN.`);
        }

        let docIdOrEmail = qrData.trim();
        if (modo !== 'manual') {
          try {
            const decoded = atob(docIdOrEmail).split('|');
            if (decoded.length === 2) {
              docIdOrEmail = decoded[0];
              if (Date.now() - parseInt(decoded[1]) > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN EXPIRADO");
            }
          } catch (e) {}
        }

        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${docIdOrEmail},email.eq.${docIdOrEmail}`).maybeSingle();
        if (!emp) throw new Error("Empleado no encontrado");
        if (modo === 'manual' && emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN del Empleado incorrecto");

        const { data: autorizador } = await supabase.from('empleados').select('nombre, rol').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
        if (!autorizador) throw new Error("PIN de Autorizador inválido");

        // --- LÓGICA DE JORNADA CONSOLIDADA ---
        const { data: jornadaActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

        if (direccion === 'entrada') {
          if (jornadaActiva) throw new Error("Ya tiene una entrada activa");
          await supabase.from('jornadas').insert([{ 
            empleado_id: emp.id, 
            nombre_empleado: emp.nombre, 
            estado: 'activo' 
          }]);
          await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        } else {
          if (!jornadaActiva) throw new Error("No hay entrada previa para marcar salida");
          const ahora = new Date();
          const horas = (ahora.getTime() - new Date(jornadaActiva.hora_entrada).getTime()) / 3600000;
          await supabase.from('jornadas').update({
            hora_salida: ahora.toISOString(),
            horas_trabajadas: horas,
            estado: 'finalizado',
            editado_por: `Autorizado: ${autorizador.nombre}`
          }).eq('id', jornadaActiva.id);
          await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        }

        alert(`✅ EXITOSO: ${emp.nombre}`);
        prepararSiguienteEmpleado();

      } catch (err: any) {
        alert(`❌ ERROR: ${err.message}`);
        setPinAutorizador('');
        setAnimar(false);
      }
    }, () => {
      alert("⚠️ GPS obligatorio");
      setAnimar(false);
    }, { enableHighAccuracy: true });
  };

  if (modo === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-2">MODO <span className="text-blue-500">SUPERVISOR</span></h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Control de Accesos Estratégico</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
          <button onClick={() => { setDireccion('entrada'); setModo('camara'); setTimeout(startCamera, 100); }} className="bg-[#0f172a] p-16 rounded-[50px] border border-white/5 hover:border-blue-500 transition-all font-black uppercase italic group">
            <span className="block text-4xl mb-2 group-hover:scale-110 transition-transform">📥</span> ENTRADA
          </button>
          <button onClick={() => { setDireccion('salida'); setModo('camara'); setTimeout(startCamera, 100); }} className="bg-[#0f172a] p-16 rounded-[50px] border border-white/5 hover:border-red-500 transition-all font-black uppercase italic group text-red-500">
            <span className="block text-4xl mb-2 group-hover:scale-110 transition-transform">📤</span> SALIDA
          </button>
        </div>
        <div className="mt-12 flex gap-4">
          <button onClick={() => setModo('manual')} className="text-slate-600 font-black uppercase text-[10px] tracking-widest border border-white/5 px-6 py-3 rounded-full hover:text-white transition-colors">Modo Manual</button>
          <button onClick={() => router.push('/admin')} className="text-slate-600 font-black uppercase text-[10px] tracking-widest border border-white/5 px-6 py-3 rounded-full hover:text-white transition-colors">Panel Admin</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#0f172a] p-10 rounded-[60px] border border-white/5 shadow-2xl relative overflow-hidden">
        
        {/* ANIMACIÓN LÁSER ORIGINAL */}
        {!lecturaLista && modo === 'camara' && (
          <div className="absolute inset-x-0 h-[2px] bg-blue-500 shadow-[0_0_15px_#3b82f6] animate-laser z-50 top-1/2"></div>
        )}

        <div className="text-center mb-10">
          <h2 className={`text-2xl font-black italic uppercase ${direccion === 'entrada' ? 'text-blue-500' : 'text-red-500'}`}>
            REGISTRO DE {direccion}
          </h2>
          <p className="text-[9px] font-black text-slate-500 uppercase mt-2 tracking-widest">Identificando Personal...</p>
        </div>

        <div className="space-y-6">
          {modo === 'manual' && !lecturaLista && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <input type="text" placeholder="ID / EMAIL" className="w-full p-5 bg-black rounded-3xl border border-white/5 outline-none focus:border-blue-500 transition-all font-bold" value={qrData} onChange={e => setQrData(e.target.value)} />
              <input type="password" placeholder="PIN EMPLEADO" className="w-full p-5 bg-black rounded-3xl border border-white/5 outline-none focus:border-blue-500 transition-all font-bold" value={pinEmpleadoManual} onChange={e => setPinEmpleadoManual(e.target.value)} />
              <button onClick={() => { if(qrData && pinEmpleadoManual) setLecturaLista(true); }} className="w-full bg-blue-600 py-5 rounded-3xl font-black uppercase">Siguiente</button>
            </div>
          )}

          {modo === 'camara' && !lecturaLista && (
            <div className="relative rounded-[40px] overflow-hidden border-2 border-white/5 h-64 bg-black">
              <div id="reader" className="w-full h-full"></div>
            </div>
          )}

          {lecturaLista && (
            <div className="space-y-6 animate-in zoom-in-95 duration-300">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-3xl text-center">
                <p className="text-emerald-500 font-black text-[10px] uppercase">Personal Identificado ✅</p>
              </div>
              <input 
                ref={pinRef}
                type="password" 
                placeholder="PIN AUTORIZADOR" 
                className="w-full py-8 bg-black rounded-[40px] text-center text-5xl font-black border-2 border-blue-600 outline-none focus:shadow-[0_0_30px_rgba(37,99,235,0.2)] transition-all" 
                value={pinAutorizador} 
                onChange={e => setPinAutorizador(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') registrarAcceso(); }}
              />
            </div>
          )}

          <button 
            onClick={registrarAcceso} 
            disabled={animar || !qrData || !pinAutorizador} 
            className="w-full py-6 bg-blue-600 rounded-[35px] font-black text-xl uppercase italic shadow-xl shadow-blue-900/20 disabled:opacity-20 transition-all"
          >
            {animar ? 'PROCESANDO...' : 'CONFIRMAR'}
          </button>

          <button 
            onClick={() => { stopCamera(); setModo('menu'); setLecturaLista(false); }} 
            className="w-full text-slate-600 font-black uppercase text-[10px] tracking-widest mt-4 hover:text-white transition-colors"
          >
            Cancelar y Volver
          </button>
        </div>
      </div>
    </main>
  );
}