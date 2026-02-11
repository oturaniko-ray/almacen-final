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
    const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const reset = () => resetTimerInactividad();
    eventos.forEach(e => document.addEventListener(e, reset));
    resetTimerInactividad();
    return () => eventos.forEach(e => document.removeEventListener(e, reset));
  }, [resetTimerInactividad]);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));

    const loadConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const m = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        const parsedLat = parseFloat(String(m.almacen_lat).replace(/[^\d.-]/g, ''));
        const parsedLon = parseFloat(String(m.almacen_lon).replace(/[^\d.-]/g, ''));
        setConfig({
          lat: isNaN(parsedLat) ? 0 : parsedLat,
          lon: isNaN(parsedLon) ? 0 : parsedLon,
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

  useEffect(() => {
    if (config.lat !== 0 && gps.lat !== 0) {
      const d = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
      setGps(prev => ({ ...prev, dist: Math.round(d) }));
    }
  }, [gps.lat, gps.lon, config]);

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
        return docId.trim().toUpperCase(); // Normalización de salida
        return docId; // Retorna original (preserva minúsculas)
      }
      return cleanText.toUpperCase();
      return cleanText;
    } catch { 
      return cleanText.toUpperCase(); 
      return cleanText; 
    }
  };

  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: "environment" }, 
        { fps: 20, qrbox: { width: 250, height: 250 } }, 
        (decoded) => {
          const doc = procesarQR(decoded);
          if (doc) {
            setQrData(doc);
            setLecturaLista(true);
            scanner.stop();
          }
        }, 
        () => {}
      ).catch(() => {});
      return () => { if(scannerRef.current?.isScanning) scannerRef.current.stop(); };
    }
  }, [modo, direccion, lecturaLista]);

  const registrarAcceso = async () => {
    if (gps.dist > config.radio) {
      showNotification(`FUERA DE RANGO: ${gps.dist}m`, "error"); 
      setTimeout(resetLectura, 2000); return;
    }
    setAnimar(true);
    const ahora = new Date().toISOString();
    
    // NORMALIZACIÓN QUIRÚRGICA DEL ID
    const idLimpio = qrData.trim().toUpperCase();

    try {
      // Corrección de la consulta .or() para evitar fallos de parsing
      const { data: emp, error: errorEmp } = await supabase
      // Búsqueda en tabla maestra sin forzar uppercase en la query
      const { data: emp, error: errEmp } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq.${idLimpio},email.eq.${idLimpio.toLowerCase()}`)
        .or(`documento_id.eq."${qrData}",email.eq."${qrData}"`)
        .maybeSingle();

      if (!emp || errorEmp) throw new Error("ID NO REGISTRADO");
      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) throw new Error("PIN TRABAJADOR INCORRECTO");
      if (!emp) throw new Error("ID NO REGISTRADO");

      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', String(pinAutorizador)).in('rol', ['supervisor', 'admin', 'Administrador']).maybeSingle();
      // Validación de PIN respetando minúsculas
      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) {
        throw new Error("PIN TRABAJADOR INCORRECTO");
      }

      const { data: aut } = await supabase
        .from('empleados')
        .select('nombre')
        .eq('pin_seguridad', String(pinAutorizador))
        .in('rol', ['supervisor', 'admin', 'Administrador'])
        .maybeSingle();

      if (!aut) throw new Error("PIN SUPERVISOR INVÁLIDO");

      const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

      if (direccion === 'entrada') {
        await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: ahora, autoriza_entrada: firma, estado: 'activo' }]);
        // Lógica corregida: No importa si no hay registros en jornadas previos
        await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, 
          nombre_empleado: emp.nombre, 
          hora_entrada: ahora, 
          autoriza_entrada: firma, 
          estado: 'activo' 
        }]);
        await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
      } else {
        const { data: j } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
        // Para salida sí buscamos el registro activo actual
        const { data: j } = await supabase
          .from('jornadas')
          .select('*')
          .eq('empleado_id', emp.id)
          .is('hora_salida', null)
          .maybeSingle();

        if (!j) throw new Error("SIN ENTRADA ACTIVA");

        const horas = parseFloat(((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2));
        await supabase.from('jornadas').update({ hora_salida: ahora, horas_trabajadas: horas, autoriza_salida: firma, estado: 'finalizado' }).eq('id', j.id);
        await supabase.from('jornadas').update({ 
          hora_salida: ahora, 
          horas_trabajadas: horas, 
          autoriza_salida: firma, 
          estado: 'finalizado' 
        }).eq('id', j.id);
        await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
      }

      showNotification("REGISTRO EXITOSO ✅", "success");
      setTimeout(resetLectura, 2000);
    } catch (e: any) { 
      showNotification(e.message, "error");
      // PROTOCOLO SENIOR: Retorno al foco inicial en error
      setPinAutorizador('');
      if (modo === 'manual') setPinEmpleado('');
      setTimeout(resetLectura, 2000);
    } finally { setAnimar(false); }
  };

  const resetLectura = () => {
    setQrData(''); setLecturaLista(false); setPinEmpleado(''); setPinAutorizador('');
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative font-sans overflow-hidden">
      {mensaje.tipo && (
        <div className={`fixed top-10 z-[100] px-8 py-4 rounded-2xl font-black shadow-2xl ${mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white animate-shake'}`}>{mensaje.texto}</div>
      )}

      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center">
        <h1 className="text-xl font-black italic uppercase leading-none">
          <span className="text-white">
            {modo === 'menu' ? 'PANEL DE LECTURA' : 
             modo === 'usb' ? 'LECTURA POR SCANNER' : 
             modo === 'camara' ? 'LECTURA POR MÓVIL' : 'ACCESO MANUAL'}
          </span>
          {modo === 'menu' && <span className="text-blue-700"> QR</span>}
        </h1>
        {user && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <p className="text-[11px] uppercase font-bold tracking-wider">
              <span className="text-white">{user.nombre}</span> 
              <span className="text-blue-600 ml-1">({user.nivel_acceso})</span>
            </p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[40px] border border-white/5 shadow-2xl relative">
        {modo === 'menu' ? (
          <div className="grid gap-4 w-full">
            <button onClick={() => setModo('usb')} className="w-full bg-blue-600 p-8 rounded-2xl text-white font-black uppercase italic text-lg active:scale-95">🔌 SCANNER USB</button>
            <button onClick={() => setModo('camara')} className="w-full bg-emerald-600 p-8 rounded-2xl text-white font-black uppercase italic text-lg active:scale-95">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 p-8 rounded-2xl text-white font-black uppercase italic text-lg border border-white/10 active:scale-95">🖋️ MANUAL</button>
            <button onClick={() => router.push('/')} className="mt-4 text-emerald-500 font-bold uppercase text-[10px] tracking-widest text-center italic">← Volver</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => setDireccion('entrada')} className="w-full py-10 bg-emerald-600 rounded-[30px] font-black text-4xl italic active:scale-95">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-10 bg-red-600 rounded-[30px] font-black text-4xl italic active:scale-95">SALIDA</button>
            <button onClick={() => { setModo('menu'); setDireccion(null); resetLectura(); }} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← VOLVER ATRÁS</button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <div className="px-3 py-2 bg-black/50 rounded-xl border border-white/5 text-center">
              <p className="text-[8.5px] font-mono text-white/50 tracking-tighter">
                Lat:{gps.lat.toFixed(8)}  Lon:{gps.lon.toFixed(8)}  <span className={gps.dist <= config.radio ? "text-emerald-500" : "text-rose-500"}>({gps.dist} mts)</span>
              </p>
            </div>

            <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-60 flex items-center justify-center relative overflow-hidden`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && <input autoFocus className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full uppercase" placeholder="ESPERANDO QR..." onKeyDown={e => { if(e.key==='Enter'){ const d=procesarQR((e.target as any).value); if(d){setQrData(d);setLecturaLista(true);}}}} />}
                    {modo === 'manual' && <input autoFocus className="bg-transparent text-center text-xl font-black text-white outline-none w-full uppercase" placeholder="DOC / CORREO" value={qrData} onChange={e => setQrData(e.target.value)} />}
                    {modo === 'usb' && <input autoFocus className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full" placeholder="ESPERANDO QR..." onKeyDown={e => { if(e.key==='Enter'){ const d=procesarQR((e.target as any).value); if(d){setQrData(d);setLecturaLista(true);}}}} />}
                    {modo === 'manual' && <input autoFocus className="bg-transparent text-center text-xl font-black text-white outline-none w-full" placeholder="DOC / CORREO" value={qrData} onChange={e => setQrData(e.target.value)} />}
                    {modo !== 'manual' && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>}
                  </>
                ) : <p className="text-emerald-500 font-black text-2xl uppercase italic animate-bounce">OK ✅</p>}
            </div>

            {modo === 'manual' && !lecturaLista && (
              <div className="space-y-2">
                <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl text-center"><p className="text-amber-500 text-[9px] font-black uppercase italic">⚠️ Requiere Validación Administrativa</p></div>
                <input type="password" placeholder="PIN TRABAJADOR" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border-2 border-white/10 text-white outline-none" value={pinEmpleado} onChange={e => setPinEmpleado(e.target.value)} />
              </div>
            )}

            {(lecturaLista || (modo === 'manual' && qrData && pinEmpleado)) && (
              <input type="password" placeholder="PIN SUPERVISOR" className="w-full py-2 bg-[#050a14] rounded-2xl text-center text-xl font-black border-4 border-blue-600 text-white outline-none" style={{ fontSize: '60%' }} value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarAcceso()} autoFocus />
            )}

            <button onClick={registrarAcceso} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic active:scale-95">{animar ? '...' : 'CONFIRMAR'}</button>
            <button onClick={() => { setDireccion(null); resetLectura(); }} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic">← VOLVER ATRÁS</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 3; }
      `}</style>
    </main>
  );