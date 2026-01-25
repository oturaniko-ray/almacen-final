'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONSTANTES DE SEGURIDAD MANTENIDAS
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

    return () => { stopCamera(); };
  }, []);

  // --- RUTINAS DE APOYO ---
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

  const prepararSiguienteEmpleado = () => {
    setQrData('');
    setPinEmpleadoManual('');
    setPinAutorizador('');
    setLecturaLista(false);
    setAnimar(false);
    if (modo === 'camara') startCamera();
  };

  const startCamera = async () => {
    if (!html5QrCode.current) html5QrCode.current = new Html5Qrcode("reader");
    html5QrCode.current.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (text) => {
        setQrData(text);
        setLecturaLista(true);
        stopCamera();
        setTimeout(() => pinRef.current?.focus(), 100);
      },
      () => {}
    );
  };

  // --- RUTINA PRINCIPAL DE REGISTRO (CONSOLIDADA) ---
  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const distancia = calcularDistancia(latitude, longitude, ALMACEN_LAT, ALMACEN_LON);

      try {
        if (distancia > RADIO_MAXIMO_METROS) {
          throw new Error(`FUERA DE RANGO: Estás a ${Math.round(distancia)}m. Límite ${RADIO_MAXIMO_METROS}m.`);
        }

        let docIdOrEmail = qrData.trim();
        
        // Desencriptación de Token QR
        if (modo !== 'manual') {
          try {
            const decoded = atob(docIdOrEmail).split('|');
            if (decoded.length === 2) {
              docIdOrEmail = decoded[0];
              const timestamp = parseInt(decoded[1]);
              if (Date.now() - timestamp > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN QR EXPIRADO");
            }
          } catch (e) { console.log("QR plano o error decodificación"); }
        }

        // 1. Validar Empleado
        const { data: emp, error: eError } = await supabase
          .from('empleados')
          .select('*')
          .or(`documento_id.eq.${docIdOrEmail},email.eq.${docIdOrEmail}`)
          .maybeSingle();

        if (eError || !emp) throw new Error("Empleado no identificado.");
        if (modo === 'manual' && emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN de empleado incorrecto.");

        // 2. Validar Supervisor/Autorizador
        const { data: autorizador } = await supabase
          .from('empleados')
          .select('nombre, rol')
          .eq('pin_seguridad', pinAutorizador)
          .in('rol', ['supervisor', 'admin', 'administrador'])
          .maybeSingle();

        if (!autorizador) throw new Error("PIN de Supervisor/Admin inválido.");

        // --- LÓGICA DE JORNADA ---
        const { data: jornadaActiva } = await supabase
          .from('jornadas')
          .select('*')
          .eq('empleado_id', emp.id)
          .is('hora_salida', null)
          .maybeSingle();

        if (direccion === 'entrada') {
          if (jornadaActiva) throw new Error(`${emp.nombre} ya tiene una entrada activa.`);
          
          await supabase.from('jornadas').insert([{
            empleado_id: emp.id,
            nombre_empleado: emp.nombre,
            hora_entrada: new Date().toISOString(),
            estado: 'activo'
          }]);
          await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        } 
        else {
          if (!jornadaActiva) throw new Error("No hay entrada previa registrada.");

          const ahora = new Date();
          const hEntrada = new Date(jornadaActiva.hora_entrada);
          const diff = (ahora.getTime() - hEntrada.getTime()) / (1000 * 60 * 60);

          await supabase.from('jornadas').update({
            hora_salida: ahora.toISOString(),
            horas_trabajadas: diff,
            estado: 'finalizado',
            editado_por: `Autorizado por: ${autorizador.nombre}`
          }).eq('id', jornadaActiva.id);
          
          await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        }

        alert(`REGISTRO EXITOSO: ${emp.nombre}`);
        prepararSiguienteEmpleado();

      } catch (err: any) {
        alert(err.message);
        setPinAutorizador('');
        setAnimar(false);
      }
    }, () => {
      alert("Error: El GPS es obligatorio.");
      setAnimar(false);
    }, { enableHighAccuracy: true });
  };

  if (modo === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] text-white p-8 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-black italic uppercase mb-12 tracking-tighter text-blue-600">MODO SUPERVISOR</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button onClick={() => { setDireccion('entrada'); setModo('camara'); setTimeout(startCamera, 100); }} className="bg-[#0f172a] p-12 rounded-[40px] border border-white/5 hover:border-blue-500 transition-all font-black uppercase italic">Marcar Entrada</button>
          <button onClick={() => { setDireccion('salida'); setModo('camara'); setTimeout(startCamera, 100); }} className="bg-[#0f172a] p-12 rounded-[40px] border border-white/5 hover:border-red-500 transition-all font-black uppercase italic text-red-500">Marcar Salida</button>
        </div>
        <button onClick={() => setModo('manual')} className="mt-8 text-slate-600 uppercase font-black text-[10px] tracking-widest">Cambiar a Modo Manual</button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-[#0f172a] p-10 rounded-[50px] border border-white/5 shadow-2xl">
        <div className="mb-8 text-center">
          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${direccion === 'entrada' ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'}`}>
            Registrando {direccion}
          </span>
        </div>

        {modo === 'manual' && !lecturaLista && (
          <div className="space-y-4">
            <input type="text" placeholder="ID o Email" className="w-full p-4 bg-black rounded-2xl border border-white/10" value={qrData} onChange={e => setQrData(e.target.value)} />
            <input type="password" placeholder="PIN Empleado" className="w-full p-4 bg-black rounded-2xl border border-white/10" value={pinEmpleadoManual} onChange={e => setPinEmpleadoManual(e.target.value)} />
            <button onClick={() => setLecturaLista(true)} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase">Siguiente</button>
          </div>
        )}

        {modo === 'camara' && !lecturaLista && (
          <div id="reader" className="w-full h-64 bg-black rounded-3xl overflow-hidden border-2 border-blue-500/20"></div>
        )}

        {lecturaLista && (
          <div className="space-y-6 animate-in fade-in zoom-in">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase">Personal Identificado</p>
              <p className="text-xl font-black text-white uppercase italic">{modo === 'manual' ? qrData : 'QR ESCANEADO ✅'}</p>
            </div>
            <input 
              ref={pinRef}
              type="password" 
              placeholder="PIN SUPERVISOR" 
              className="w-full py-6 bg-black rounded-[30px] text-center text-4xl font-black border-2 border-blue-600 focus:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
              value={pinAutorizador}
              onChange={e => setPinAutorizador(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && registrarAcceso()}
            />
            <button 
              onClick={registrarAcceso}
              disabled={animar}
              className="w-full bg-blue-600 py-6 rounded-[30px] font-black uppercase italic text-xl shadow-lg shadow-blue-900/40"
            >
              {animar ? 'PROCESANDO...' : 'CONFIRMAR'}
            </button>
          </div>
        )}

        <button onClick={() => { stopCamera(); setModo('menu'); setLecturaLista(false); }} className="mt-10 w-full text-slate-600 font-black uppercase text-[10px] tracking-widest">Volver al Menú</button>
      </div>
    </main>
  );
}