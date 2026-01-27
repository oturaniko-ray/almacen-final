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
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Validar Sesión y Cierre por Inactividad
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));

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
      if (scannerRef.current) scannerRef.current.stop();
    };
  }, [router]);

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
          // Actualización de campo preciso para Presencia
          await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
        } else {
          const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
          if (!jActiva) throw new Error("No tiene una jornada activa.");
          await supabase.from('jornadas').update({ hora_salida: ahora, estado: 'finalizado' }).eq('id', jActiva.id);
          // Actualización de campo preciso para Presencia
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
      alert("Error: Se requiere GPS");
      setAnimar(false);
    });
  };

  // Lógica de escaneo y renderizado omitida aquí para brevedad pero mantenida igual al original en tu implementación funcional
  // ... (Se mantienen idénticos los bloques de renderizado de botones y escáner del archivo original)

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

        {/* El resto del JSX (botones, escáner, inputs) se mantiene exactamente igual al archivo que me enviaste */}
        {/* ... (Bloques de modo === 'menu', 'usb', 'camara', etc.) */}
        
        {/* Fragmento de ejemplo del botón volver para asegurar ubicación */}
        <button onClick={() => setModo('menu')} className="mt-8 text-center w-full text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] hover:text-white transition-all">← Volver al Menú</button>
      </div>
    </main>
  );
}