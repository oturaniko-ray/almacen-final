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
  
  const [alertaGps, setAlertaGps] = useState<{ visible: boolean; metros: number }>({ visible: false, metros: 0 });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  const resetLectura = useCallback(() => {
    setQrData(''); 
    setLecturaLista(false); 
    setPinEmpleado(''); 
    setPinAutorizador('');
    if (scannerRef.current?.isScanning) scannerRef.current.stop();
  }, []);

  const manejarFueraDeRango = useCallback((distancia: number) => {
    setAlertaGps({ visible: true, metros: Math.round(distancia) });
    setDireccion(null);
    setModo('menu');
    resetLectura();
    setTimeout(() => setAlertaGps({ visible: false, metros: 0 }), 2000);
  }, [resetLectura]);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));

    const loadConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const m = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          lat: parseFloat(String(m.almacen_lat)) || 0,
          lon: parseFloat(String(m.almacen_lon)) || 0,
          radio: parseInt(m.radio_maximo) || 100,
          qr_exp: parseInt(m.timer_token) || 30000
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
      setGps(prev => {
        if (modo !== 'menu' && d > config.radio && !alertaGps.visible) {
          manejarFueraDeRango(d);
        }
        return { ...prev, dist: Math.round(d) };
      });
    }
  }, [gps.lat, gps.lon, config, modo, manejarFueraDeRango, alertaGps.visible]);

  const intentarEntrarModo = (nuevoModo: 'usb' | 'camara' | 'manual') => {
    const d = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
    if (d > config.radio) {
      manejarFueraDeRango(d);
      return;
    }
    setModo(nuevoModo);
  };

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

  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      scanner.start({ facingMode: "environment" }, { fps: 20, qrbox: { width: 250, height: 250 } }, 
        (decoded) => {
          const doc = procesarQR(decoded);
          if (doc) { setQrData(doc); setLecturaLista(true); scanner.stop(); }
        }, () => {}
      ).catch(() => {});
      return () => { if(scannerRef.current?.isScanning) scannerRef.current.stop(); };
    }
  }, [modo, direccion, lecturaLista]);

  const registrarAcceso = async () => {
    const d = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
    if (d > config.radio) {
      manejarFueraDeRango(d);
      return;
    }
    setAnimar(true);
    const ahora = new Date().toISOString();
    try {
      // 1. Buscamos el empleado para obtener su UUID exacto
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq."${qrData}",email.eq."${qrData}",id.eq."${qrData}"`).maybeSingle();
      if (!emp) throw new Error("ID NO REGISTRADO");
      
      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) throw new Error("PIN TRABAJADOR INCORRECTO");
      
      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', String(pinAutorizador)).in('rol', ['supervisor', 'admin', 'Administrador']).maybeSingle();
      if (!aut) throw new Error("PIN SUPERVISOR INVÁLIDO");

      const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;
      
      if (direccion === 'entrada') {
        const { error: errE } = await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: ahora, autoriza_entrada: firma, estado: 'activo' }]);
        if (errE) throw errE;
        await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
      } else {
        // AJUSTE QUIRÚRGICO: Búsqueda infalible de la jornada abierta por UUID
        const { data: j } = await supabase.from('jornadas')
          .select('*')
          .eq('empleado_id', emp.id)
          .is('hora_salida', null)
          .order('hora_entrada', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!j) throw new Error("SIN ENTRADA ACTIVA");

        const horas = parseFloat(((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2));
        
        const { error: errS } = await supabase.from('jornadas')
          .update({ hora_salida: ahora, horas_trabajadas: horas, autoriza_salida: firma, estado: 'finalizado' })
          .eq('id', j.id);
        
        if (errS) throw errS;
        await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
      }
      showNotification("REGISTRO EXITOSO ✅", "success");
      setTimeout(() => { setDireccion(null); resetLectura(); }, 1500);
    } catch (e: any) { 
      showNotification(e.message, "error");
    } finally { setAnimar(false); }
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative font-sans overflow-hidden">
      {alertaGps.visible && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-amber-500 text-black p-8 rounded-[30px] border-4 border-white shadow-2xl animate-in zoom-in duration-200">
            <p className="text-xl font-black uppercase italic text-center">Supervisor fuera de rango: ({alertaGps.metros}m)</p>
          </div>
        </div>
      )}

      {mensaje.tipo && (
        <div className={`fixed top-10 z-[100] px-8 py-4 rounded-2xl font-black shadow-2xl ${mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white animate-shake'}`}>{mensaje.texto}</div>
      )}

      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center">
        <h1 className="text-xl font-black italic uppercase leading-none text-white">
          {modo === 'menu' ? 'PANEL DE LECTURA' : modo === 'camara' ? 'LECTURA POR MÓVIL' : modo === 'usb' ? 'LECTURA POR SCANNER' : 'ACCESO MANUAL'}
        </h1>
        {user && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <p className="text-[11px] uppercase font-bold tracking-wider text-white">{user.nombre} <span className="text-blue-600 ml-1">({user.nivel_acceso})</span></p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[40px] border border-white/5 shadow-2xl relative">
        {modo === 'menu' ? (
          <div className="grid gap-4 w-full">
            <button onClick={() => intentarEntrarModo('usb')} className="w-full bg-blue-600 p-8 rounded-2xl text-white font-black uppercase italic text-lg active:scale-95">🔌 SCANNER USB</button>
            <button onClick={() => intentarEntrarModo('camara')} className="w-full bg-emerald-600 p-8 rounded-2xl text-white font-black uppercase italic text-lg active:scale-95">📱 CÁMARA MÓVIL</button>
            <button onClick={() => intentarEntrarModo('manual')} className="w-full bg-white/5 p-8 rounded-2xl text-white font-black uppercase italic text-lg border border-white/10 active:scale-95">🖋️ MANUAL</button>
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
                Lat:{gps.lat.toFixed(8)} Lon:{gps.lon.toFixed(8)} <span className={gps.dist <= config.radio ? "text-emerald-500" : "text-rose-500"}>({gps.dist} mts)</span>
              </p>
            </div>
            <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-60 flex items-center justify-center relative overflow-hidden`}>
              {!lecturaLista ? (
                <>
                  {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                  {modo === 'usb' && <input autoFocus className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full uppercase" placeholder="ESPERANDO QR..." onKeyDown={e => { if(e.key==='Enter'){ const d=procesarQR((e.target as any).value); if(d){setQrData(d);setLecturaLista(true);}}}} />}
                  {modo === 'manual' && <input autoFocus className="bg-transparent text-center text-xl font-black text-white outline-none w-full uppercase" placeholder="DOC / CORREO" value={qrData} onChange={e => setQrData(e.target.value)} />}
                </>
              ) : <p className="text-emerald-500 font-black text-2xl uppercase italic animate-bounce">OK ✅</p>}
            </div>
            {modo === 'manual' && !lecturaLista && (
              <input type="password" placeholder="PIN TRABAJADOR" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border-2 border-white/10 text-white outline-none" value={pinEmpleado} onChange={e => setPinEmpleado(e.target.value)} />
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
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 3; }
      `}</style>
    </main>
  );
}