'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
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

    // ⏱️ SEGURIDAD: Inactividad 2 min
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
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [router]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
        if (dist > RADIO_MAXIMO_METROS) throw new Error(`FUERA DE RANGO`);

        let idFinal = qrData.trim();
        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${idFinal},email.eq.${idFinal}`).maybeSingle();
        if (!emp) throw new Error(`Empleado no encontrado`);

        const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
        if (!aut) throw new Error("PIN Supervisor inválido");

        const ahora = new Date().toISOString();

        if (direccion === 'entrada') {
          await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: ahora, estado: 'activo' }]);
          // 📍 Actualización precisa de ingreso
          await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
        } else {
          const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
          if (!jActiva) throw new Error("No hay entrada registrada.");
          await supabase.from('jornadas').update({ hora_salida: ahora, estado: 'finalizado' }).eq('id', jActiva.id);
          // 📍 Actualización precisa de salida
          await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
        }

        alert(`✅ Éxito: ${emp.nombre}`);
        setModo('menu'); setDireccion(null); setQrData(''); setPinAutorizador(''); setAnimar(false);
      } catch (err: any) { alert(`❌ ${err.message}`); setAnimar(false); }
    }, () => alert("GPS Obligatorio"));
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <header className="mb-8 text-center">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 tracking-tighter">Panel de Supervisión</h2>
          {user && (
            <div className="mt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Supervisor: {user.nombre}</p>
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.2em]">{user.rol}</p>
            </div>
          )}
        </header>
        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:border-blue-500 border border-transparent transition-all">Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:border-emerald-500 border border-transparent transition-all">Cámara</button>
            <button onClick={() => router.push('/')} className="mt-4 text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">← Salir</button>
          </div>
        ) : (
          <div className="space-y-6">
             {!direccion ? (
               <div className="grid gap-4">
                 <button onClick={() => setDireccion('entrada')} className="py-10 bg-emerald-600 rounded-[30px] font-black text-2xl">ENTRADA</button>
                 <button onClick={() => setDireccion('salida')} className="py-10 bg-red-600 rounded-[30px] font-black text-2xl">SALIDA</button>
                 <button onClick={() => setModo('menu')} className="text-center text-slate-500 text-[10px] font-bold">Volver</button>
               </div>
             ) : (
               <div className="space-y-4">
                 <input type="password" placeholder="PIN Supervisor para confirmar" className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-xl font-black border-2 border-blue-500/20" value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrarAcceso()} />
                 <button onClick={registrarAcceso} className="w-full py-6 bg-blue-600 rounded-[30px] font-black uppercase italic">Confirmar {direccion}</button>
               </div>
             )}
          </div>
        )}
      </div>
    </main>
  );
}