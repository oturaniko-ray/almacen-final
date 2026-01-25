'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONSTANTES DE SEGURIDAD
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
    if (!['admin', 'administrador', 'supervisor'].includes(currentUser.rol)) { 
      router.replace('/'); 
      return; 
    }
    setUser(currentUser);
    return () => { stopCamera(); };
  }, [router]);

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const stopCamera = async () => {
    if (html5QrCode.current && html5QrCode.current.isScanning) {
      await html5QrCode.current.stop();
    }
  };

  const startCamera = async () => {
    if (!html5QrCode.current) html5QrCode.current = new Html5Qrcode("reader");
    try {
      await html5QrCode.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          setQrData(text);
          setLecturaLista(true);
          stopCamera();
          setTimeout(() => pinRef.current?.focus(), 200);
        },
        () => {}
      );
    } catch (err) {
      console.error("Error cámara:", err);
    }
  };

  const prepararSiguiente = () => {
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
          throw new Error(`FUERA DE RANGO: Estás a ${Math.round(distancia)}m.`);
        }

        let idFinal = qrData.trim();
        if (modo !== 'manual') {
          try {
            const decoded = atob(idFinal).split('|');
            if (decoded.length === 2) {
              idFinal = decoded[0];
              if (Date.now() - parseInt(decoded[1]) > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN EXPIRADO");
            }
          } catch (e) {}
        }

        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${idFinal},email.eq.${idFinal}`).maybeSingle();
        if (!emp) throw new Error("Empleado no encontrado");
        if (modo === 'manual' && emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN Empleado incorrecto");

        const { data: supervisor } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
        if (!supervisor) throw new Error("PIN Supervisor inválido");

        const { data: abierta } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

        if (direccion === 'entrada') {
          if (abierta) throw new Error("Ya tiene una entrada activa");
          await supabase.from('jornadas').insert([{ 
            empleado_id: emp.id, 
            nombre_empleado: emp.nombre, 
            estado: 'activo' 
          }]);
          await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        } else {
          if (!abierta) throw new Error("No hay entrada previa");
          const ahora = new Date();
          const horas = (ahora.getTime() - new Date(abierta.hora_entrada).getTime()) / 3600000;
          await supabase.from('jornadas').update({
            hora_salida: ahora.toISOString(),
            horas_trabajadas: horas,
            estado: 'finalizado',
            editado_por: `Supervisor: ${supervisor.nombre}`
          }).eq('id', abierta.id);
          await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        }

        alert("REGISTRO EXITOSO");
        prepararSiguiente();
      } catch (err: any) {
        alert(err.message);
        setPinAutorizador('');
        setAnimar(false);
      }
    }, () => {
      alert("GPS Requerido");
      setAnimar(false);
    }, { enableHighAccuracy: true });
  };

  if (modo === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-black italic mb-12 uppercase tracking-tighter text-blue-500">CONTROL SUPERVISOR</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
          <button onClick={() => { setDireccion('entrada'); setModo('camara'); setTimeout(startCamera, 100); }} className="bg-[#0f172a] p-12 rounded-[40px] border border-white/5 font-black uppercase italic hover:border-blue-500 transition-all">Entrada</button>
          <button onClick={() => { setDireccion('salida'); setModo('camara'); setTimeout(startCamera, 100); }} className="bg-[#0f172a] p-12 rounded-[40px] border border-white/5 font-black uppercase italic hover:border-red-500 text-red-500 transition-all">Salida</button>
        </div>
        <button onClick={() => setModo('manual')} className="mt-8 text-slate-600 font-black uppercase text-[10px] tracking-widest">Cambiar a Manual</button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#0f172a] p-10 rounded-[50px] border border-white/5 shadow-2xl relative">
        <h2 className="text-center font-black uppercase text-blue-500 mb-8 italic">Registrando {direccion}</h2>
        
        {!lecturaLista ? (
          modo === 'camara' ? (
            <div id="reader" className="w-full h-64 bg-black rounded-3xl overflow-hidden border-2 border-blue-500/20"></div>
          ) : (
            <div className="space-y-4">
              <input type="text" placeholder="ID/Email" className="w-full p-4 bg-black rounded-2xl border border-white/10" value={qrData} onChange={e => setQrData(e.target.value)} />
              <input type="password" placeholder="PIN Empleado" className="w-full p-4 bg-black rounded-2xl border border-white/10" value={pinEmpleadoManual} onChange={e => setPinEmpleadoManual(e.target.value)} />
              <button onClick={() => setLecturaLista(true)} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase">Siguiente</button>
            </div>
          )
        ) : (
          <div className="space-y-6">
            <p className="text-center text-sm font-black text-emerald-500 uppercase">Personal Identificado ✅</p>
            <input ref={pinRef} type="password" placeholder="PIN SUPERVISOR" className="w-full py-6 bg-black rounded-[30px] text-center text-4xl font-black border-2 border-blue-600" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarAcceso()} />
            <button onClick={registrarAcceso} disabled={animar} className="w-full bg-blue-600 py-6 rounded-[30px] font-black uppercase italic">{animar ? 'PROCESANDO...' : 'Confirmar'}</button>
          </div>
        )}
        
        <button onClick={() => { stopCamera(); setModo('menu'); setLecturaLista(false); }} className="mt-8 w-full text-slate-600 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
      </div>
    </main>
  );
}