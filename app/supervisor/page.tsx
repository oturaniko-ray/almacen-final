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

  // --- LÓGICA DE SESIÓN ÚNICA SEGMENTADA ---
  useEffect(() => {
    // Recuperar el usuario de la sesión actual
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.push('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);

    const canalSesion = supabase.channel('supervisor-session-control');

    canalSesion
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        // Solo cerrar si es el MISMO usuario (email) pero DIFERENTE instancia (sessionId)
        if (payload.payload.email === currentUser.email && payload.payload.id !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => {
            localStorage.removeItem('user_session');
            router.push('/');
          }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSesion.send({
            type: 'broadcast',
            event: 'nueva-sesion',
            payload: { 
              id: sessionId.current, 
              email: currentUser.email 
            },
          });
        }
      });

    return () => { supabase.removeChannel(canalSesion); };
  }, [router]);

  const volverAtras = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch (e) { console.warn("Error deteniendo cámara:", e); }

    if (direccion) {
      setDireccion(null); setQrData(''); setPinAutorizador(''); setPinEmpleadoManual(''); setLecturaLista(false);
    } else if (modo !== 'menu') { 
      setModo('menu'); 
    }
  };

  const prepararSiguienteEmpleado = () => {
    setQrData('');
    setPinEmpleadoManual('');
    setPinAutorizador('');
    setLecturaLista(false);
    setAnimar(false);
    if (modo === 'manual') {
      setTimeout(() => docInputRef.current?.focus(), 100);
    }
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          setQrData(buffer.trim());
          setLecturaLista(true);
          setTimeout(() => pinRef.current?.focus(), 100);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) {
      const iniciarCamara = async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: 250 }, 
            (text) => {
              setQrData(text);
              setLecturaLista(true);
              scanner.stop().then(() => { scannerRef.current = null; });
              setTimeout(() => pinRef.current?.focus(), 200);
            }, 
            () => {}
          );
        } catch (err) { console.error("Error cámara:", err); }
      };
      setTimeout(iniciarCamara, 300); 
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {}); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    if (modo === 'manual' && !pinEmpleadoManual) return;
    
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
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

        const { data: emp } = await supabase
          .from('empleados')
          .select('*')
          .or(`documento_id.eq.${docIdOrEmail},email.eq.${docIdOrEmail}`)
          .maybeSingle();

        if (!emp) throw new Error("Empleado no encontrado");

        if (modo === 'manual') {
          if (emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN del Empleado incorrecto");
        }

        const { data: autorizador } = await supabase
          .from('empleados')
          .select('nombre, rol')
          .eq('pin_seguridad', pinAutorizador)
          .in('rol', ['supervisor', 'admin', 'administrador'])
          .maybeSingle();

        if (!autorizador) {
            const errorMsg = modo === 'manual' ? "PIN de Administrador inválido" : "PIN de Supervisor inválido";
            throw new Error(errorMsg);
        }

        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `${modo === 'manual' ? 'ADMINISTRADOR' : 'SUPERVISOR'} ${modo.toUpperCase()} - Autoriza: ${autorizador.nombre}`
        }]);

        alert(`✅ Operación Exitosa: ${emp.nombre}`);
        prepararSiguienteEmpleado();

      } catch (err: any) { 
        alert(`❌ ${err.message}`); 
        setPinAutorizador('');
        if (modo === 'manual') setPinEmpleadoManual('');
        setAnimar(false);
      }
    }, () => {
      alert("GPS Obligatorio");
      setAnimar(false);
    });
  };

  // VISTA DE SESIÓN BLOQUEADA
  if (sesionDuplicada) {
    return (
      <main className="h-screen bg-black flex items-center justify-center p-10 text-center">
        <div className="bg-red-600/20 border-2 border-red-600 p-10 rounded-[40px] shadow-[0_0_50px_rgba(220,38,38,0.3)] animate-pulse">
          <h2 className="text-4xl font-black text-red-500 mb-4 uppercase italic tracking-tighter">Acceso Denegado</h2>
          <p className="text-white text-xl font-bold max-w-md">Se ha detectado que has iniciado sesión en otro dispositivo. Por seguridad, esta sesión se cerrará.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-laser { animation: laser 2s infinite linear; }
        .animate-blink { animation: blink 1s infinite ease-in-out; }
      `}</style>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative z-10">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-1 text-center tracking-tighter">Panel de Supervisión</h2>
        
        {modo === 'manual' && (
          <p className="text-amber-500 font-bold text-center text-[12px] uppercase tracking-widest mb-6 animate-blink">
            Control Manual Administrador
          </p>
        )}

        {modo === 'menu' ? (
          <div className="grid gap-4 text-center">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all uppercase tracking-widest">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all uppercase tracking-widest">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-slate-400 transition-all uppercase tracking-widest">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-6 text-slate-500 font-bold uppercase text-[11px] tracking-[0.3em] hover:text-blue-400 transition-colors">← Volver al Menú de Roles</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl hover:scale-[1.02] transition-transform">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-