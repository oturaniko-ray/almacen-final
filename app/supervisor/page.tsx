'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; 
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState(''); 
  const [pinEmpleado, setPinEmpleado] = useState(''); 
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ lat: 0, lon: 0, radio: 100, qr_exp: 30000 });
  const [gps, setGps] = useState({ lat: 0, lon: 0, dist: 999999 });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timerInactividadRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const resetTimerInactividad = useCallback(() => {
    if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);
    timerInactividadRef.current = setTimeout(() => {
      if (scannerRef.current?.isScanning) scannerRef.current.stop();
      localStorage.clear();
      router.push('/');
    }, 90000); 
  }, [router]);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));

    const loadConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const m = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          lat: parseFloat(String(m.almacen_lat).replace(/[^\d.-]/g, '')) || 0,
          lon: parseFloat(String(m.almacen_lon).replace(/[^\d.-]/g, '')) || 0,
          radio: parseInt(m.radio_permitido) || 100,
          qr_exp: parseInt(m.qr_expiracion) || 30000
        });
      }
    };
    loadConfig();

    const watchId = navigator.geolocation.watchPosition((pos) => {
      setGps(prev => ({ ...prev, lat: pos.coords.latitude, lon: pos.coords.longitude }));
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  const procesarQR = (texto: string) => {
    const cleanText = texto.replace(/[\n\r]/g, '').trim();
    try {
      const decoded = atob(cleanText);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        if (Date.now() - parseInt(timestamp) > config.qr_exp) {
          showNotification("QR EXPIRADO", "error"); 
          return '';
        }
        return docId;
      }
      return cleanText;
    } catch { return cleanText; }
  };

  const registrarAcceso = async () => {
    if (gps.dist > config.radio) {
      showNotification(`FUERA DE RANGO: ${gps.dist}m`, "error"); 
      setTimeout(resetLectura, 2000); return;
    }
    setAnimar(true);
    const ahora = new Date().toISOString();
    const inputBusqueda = qrData.trim();

    try {
      // 1. Obtener datos del empleado desde la tabla MAESTRA
      let { data: emp, error: empErr } = await supabase
        .from('empleados')
        .select('id, nombre, pin_seguridad, activo, documento_id')
        .eq('documento_id', inputBusqueda)
        .maybeSingle();

      if (!emp) {
        const { data: empEmail } = await supabase
          .from('empleados')
          .select('id, nombre, pin_seguridad, activo')
          .eq('email', inputBusqueda.toLowerCase())
          .maybeSingle();
        emp = empEmail;
      }

      if (empErr) throw new Error(`ERROR BUSQUEDA: ${JSON.stringify(empErr)}`);
      if (!emp) throw new Error("ID NO REGISTRADO EN EMPLEADOS");
      if (!emp.activo) throw new Error("EMPLEADO INACTIVO");

      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) {
        throw new Error("PIN TRABAJADOR INCORRECTO");
      }

      // 2. Validar Supervisor
      const { data: aut, error: autErr } = await supabase
        .from('empleados')
        .select('nombre')
        .eq('pin_seguridad', String(pinAutorizador))
        .in('rol', ['supervisor', 'admin', 'Administrador'])
        .maybeSingle();

      if (autErr || !aut) throw new Error("PIN SUPERVISOR INVÁLIDO O ERROR DB");

      const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

      if (direccion === 'entrada') {
        // INSERCIÓN: jornadas/empleado_id vinculado con empleados/id
        const { error: insErr } = await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, 
          nombre_empleado: emp.nombre, 
          hora_entrada: ahora, 
          autoriza_entrada: firma, 
          estado: 'activo' 
        }]);
        
        if (insErr) throw new Error(`FALLO INSERCIÓN (TRIGGER?): ${JSON.stringify(insErr)}`);
        
        await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);

      } else {
        // Lógica de Salida
        const { data: j, error: jErr } = await supabase
          .from('jornadas')
          .select('*')
          .eq('empleado_id', emp.id)
          .is('hora_salida', null)
          .order('hora_entrada', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (jErr || !j) throw new Error("SIN ENTRADA ACTIVA O ERROR DE SESIÓN");

        const horas = parseFloat(((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2));
        
        const { error: updErr } = await supabase.from('jornadas').update({ 
          hora_salida: ahora, 
          horas_trabajadas: horas, 
          autoriza_salida: firma, 
          estado: 'finalizado' 
        }).eq('id', j.id);

        if (updErr) throw new Error(`FALLO SALIDA: ${JSON.stringify(updErr)}`);

        await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
      }

      showNotification("REGISTRO EXITOSO ✅", "success");
      setTimeout(resetLectura, 2000);
    } catch (e: any) { 
      // Captura quirúrgica del error stringificado para depuración técnica
      showNotification(e.message, "error");
      console.error("Detalle técnico del error:", e.message);
      setTimeout(resetLectura, 4000); // Más tiempo para leer el error JSON
    } finally { setAnimar(false); }
  };

  const resetLectura = () => {
    setQrData(''); setLecturaLista(false); setPinEmpleado(''); setPinAutorizador('');
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 6000); // Aumentado para leer JSON
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative font-sans overflow-hidden">
      {mensaje.tipo && (
        <div className={`fixed top-10 z-[100] px-6 py-4 rounded-2xl font-bold shadow-2xl max-w-[90%] break-words text-center ${mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white animate-shake'}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center">
        <h1 className="text-xl font-black italic uppercase leading-none">
          <span className="text-white">{modo === 'menu' ? 'PANEL DE LECTURA' : modo === 'usb' ? 'LECTURA USB' : modo === 'camara' ? 'LECTURA MÓVIL' : 'ACCESO MANUAL'}</span>
        </h1>
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[40px] border border-white/5 shadow-2xl relative">
        {modo === 'menu' ? (
          <div className="grid gap-4 w-full">
            <button onClick={() => setModo('usb')} className="w-full bg-blue-600 p-8 rounded-2xl text-white font-black uppercase italic active:scale-95">🔌 SCANNER USB</button>
            <button onClick={() => setModo('camara')} className="w-full bg-emerald-600 p-8 rounded-2xl text-white font-black uppercase italic active:scale-95">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 p-8 rounded-2xl text-white font-black uppercase italic border border-white/10 active:scale-95">🖋️ MANUAL</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => setDireccion('entrada')} className="w-full py-10 bg-emerald-600 rounded-[30px] font-black text-4xl italic">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-10 bg-red-600 rounded-[30px] font-black text-4xl italic">SALIDA</button>
            <button onClick={() => { setModo('menu'); setDireccion(null); }} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← VOLVER</button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-60 flex items-center justify-center relative overflow-hidden`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && <input autoFocus className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full uppercase" placeholder="ESPERANDO QR..." onKeyDown={e => { if(e.key==='Enter'){ const d=procesarQR((e.target as any).value); if(d){setQrData(d);setLecturaLista(true);}}}} />}
                    {modo === 'manual' && <input autoFocus className="bg-transparent text-center text-xl font-black text-white outline-none w-full uppercase" placeholder="DOC / CORREO" value={qrData} onChange={e => setQrData(e.target.value)} />}
                  </>
                ) : <p className="text-emerald-500 font-black text-2xl uppercase italic animate-bounce">OK ✅</p>}
            </div>

            {(lecturaLista || (modo === 'manual' && qrData)) && (
              <input type="password" placeholder="PIN SUPERVISOR" className="w-full py-2 bg-[#050a14] rounded-2xl text-center text-xl font-black border-4 border-blue-600 text-white outline-none" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarAcceso()} autoFocus />
            )}
            
            <button onClick={registrarAcceso} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic active:scale-95">{animar ? '...' : 'CONFIRMAR'}</button>
            <button onClick={() => { setDireccion(null); resetLectura(); }} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] italic">← VOLVER</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 3; }
      `}</style>
    </main>
  );
}