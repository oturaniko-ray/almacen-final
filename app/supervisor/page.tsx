'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
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
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | 'warning' | null }>({ texto: '', tipo: null });
  const [supervisorSesion, setSupervisorSesion] = useState<any>(null);
  const [config, setConfig] = useState<any>({ lat: 0, lon: 0, radio: 100, qr_exp: 30000 });
  const [gps, setGps] = useState({ lat: 0, lon: 0, dist: 0 });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const showNotification = (texto: string, tipo: 'success' | 'error' | 'warning') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setSupervisorSesion(JSON.parse(sessionData));

    const loadConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const m = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          lat: parseFloat(m.latitud_almacen),
          lon: parseFloat(m.longitud_almacen),
          radio: parseFloat(m.radio_permitido) || 100,
          qr_exp: parseInt(m.qr_expiracion) || 30000
        });
      }
    };
    loadConfig();

    const watchId = navigator.geolocation.watchPosition((pos) => {
      setGps(prev => ({ ...prev, lat: pos.coords.latitude, lon: pos.coords.longitude }));
    }, (err) => console.error("Error GPS:", err), { enableHighAccuracy: true });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  // Recálculo de distancia reactivo
  useEffect(() => {
    if (config.lat && config.lon && gps.lat && gps.lon) {
      const d = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
      setGps(prev => ({ ...prev, dist: Math.round(d) }));
    }
  }, [gps.lat, gps.lon, config]);

  // Lógica Cámara Corregida
  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      const timer = setTimeout(async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 25, qrbox: { width: 250, height: 250 } },
            (decoded) => {
              const doc = procesarQR(decoded);
              if (doc) { 
                setQrData(doc); 
                setLecturaLista(true); 
                scanner.stop().catch(() => {});
              }
            },
            () => {}
          );
        } catch (e) { console.error("Fallo cámara:", e); }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [modo, direccion, lecturaLista]);

  const procesarQR = (texto: string) => {
    try {
      const decoded = atob(texto);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        if (Date.now() - parseInt(timestamp) > config.qr_exp) {
          showNotification("QR EXPIRADO", "error"); return '';
        }
        return docId;
      }
      return texto;
    } catch { return texto; }
  };

  const registrarAcceso = async () => {
    if (gps.dist > config.radio) {
      showNotification("FUERA DE RANGO GEOGRÁFICO", "error"); return;
    }
    setAnimar(true);
    const ahora = new Date().toISOString();

    try {
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq."${qrData}",email.eq."${qrData}"`).maybeSingle();
      if (!emp) throw new Error("ID NO REGISTRADO");
      
      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) throw new Error("PIN TRABAJADOR INCORRECTO");

      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', String(pinAutorizador)).in('rol', ['supervisor', 'admin', 'Administrador']).maybeSingle();
      if (!aut) throw new Error("PIN AUTORIZADOR INVÁLIDO");

      const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

      if (direccion === 'entrada') {
        await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: ahora, autoriza_entrada: firma, estado: 'activo' }]);
        await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
      } else {
        const { data: j } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
        if (!j) throw new Error("SIN ENTRADA ACTIVA");
        const horas = parseFloat(((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2));
        await supabase.from('jornadas').update({ hora_salida: ahora, horas_trabajadas: horas, autoriza_salida: firma, estado: 'finalizado' }).eq('id', j.id);
        await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
      }

      showNotification("REGISTRO EXITOSO ✅", "success");
      cancelar();
    } catch (e: any) { 
      showNotification(e.message, "error");
      setQrData(''); setLecturaLista(false); setPinEmpleado(''); setPinAutorizador('');
    } finally { setAnimar(false); }
  };

  const cancelar = () => {
    if (scannerRef.current?.isScanning) scannerRef.current.stop();
    setModo('menu'); setDireccion(null); setQrData(''); setLecturaLista(false); 
    setPinAutorizador(''); setPinEmpleado('');
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative font-sans overflow-hidden">
      
      {mensaje.tipo && (
        <div className={`fixed top-10 z-[100] px-8 py-4 rounded-2xl font-black shadow-2xl animate-bounce ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 
          mensaje.tipo === 'warning' ? 'bg-amber-500 text-black' : 'bg-rose-600 text-white'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* MEMBRETE REESTRUCTURADO */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center">
        <h1 className="text-xl font-black italic uppercase text-white leading-none">PANEL DE LECTURA <span className="text-blue-700">QR</span></h1>
        {modo !== 'menu' && <p className="text-blue-500 font-bold text-[10px] uppercase tracking-widest mt-1">
          {modo === 'usb' ? 'Lectura por Scanner' : modo === 'camara' ? 'Lectura por móvil' : 'Acceso Manual'}</p>}
        {supervisorSesion && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <p className="text-[13px] text-white/90 uppercase font-bold tracking-tight">
              {supervisorSesion.nombre} <span className="text-white/30 font-medium ml-1">({supervisorSesion.nivel_acceso})</span>
            </p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[40px] border border-white/5 shadow-2xl relative">
        {modo === 'menu' ? (
          <div className="grid gap-4 w-full">
            <p className="text-[13px] font-bold uppercase tracking-[0.4em] text-white/30 text-center">Opciones</p>
            <button onClick={() => setModo('usb')} className="w-full bg-blue-600 p-8 rounded-2xl text-white font-black uppercase italic text-lg active:scale-95 transition-all">🔌 SCANNER USB</button>
            <button onClick={() => setModo('camara')} className="w-full bg-emerald-600 p-8 rounded-2xl text-white font-black uppercase italic text-lg active:scale-95 transition-all">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 p-8 rounded-2xl text-white font-black uppercase italic text-lg border border-white/10 active:scale-95 transition-all">🖋️ MANUAL</button>
            <button onClick={() => router.push('/')} className="mt-4 text-emerald-500 font-bold uppercase text-[10px] tracking-widest text-center italic">← Volver al menú anterior</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => setDireccion('entrada')} className="w-full py-8 bg-emerald-600 rounded-[30px] font-black text-4xl italic active:scale-95">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-8 bg-red-600 rounded-[30px] font-black text-4xl italic active:scale-95">SALIDA</button>
            <button onClick={cancelar} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← VOLVER</button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {/* TELEMETRÍA UNIFICADA */}
            <div className="px-3 py-2 bg-black/50 rounded-xl border border-white/5 text-center">
              <p className="text-[8.5px] font-mono text-white/50 tracking-tighter">
                Lat:{gps.lat}  Lon:{gps.lon}  <span className={gps.dist <= config.radio ? "text-emerald-500" : "text-rose-500"}>({gps.dist} mts)</span>
              </p>
            </div>

            <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-60 flex items-center justify-center relative overflow-hidden`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full z-10"></div>}
                    {modo === 'usb' && <input autoFocus className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full" placeholder="ESPERANDO QR..." onKeyDown={e => { if(e.key==='Enter'){ const d=procesarQR((e.target as any).value); if(d){setQrData(d);setLecturaLista(true);}}}} />}
                    {modo === 'manual' && <input autoFocus className="bg-transparent text-center text-xl font-black text-white outline-none w-full uppercase" placeholder="DOC / CORREO" value={qrData} onChange={e => setQrData(e.target.value)} />}
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_red] animate-scan-laser z-20"></div>
                  </>
                ) : <p className="text-emerald-500 font-black text-2xl uppercase italic">VALIDADO ✅</p>}
            </div>

            {modo === 'manual' && !lecturaLista && (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl text-center animate-pulse">
                   <p className="text-amber-500 text-[9px] font-black uppercase italic">⚠️ Requiere Validación Administrativa</p>
                </div>
                <input type="password" placeholder="PIN DEL TRABAJADOR" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border-2 border-white/10 text-white outline-none" value={pinEmpleado} onChange={e => setPinEmpleado(e.target.value)} />
              </div>
            )}

            {(lecturaLista || (modo === 'manual' && qrData && pinEmpleado)) && (
              <input 
                ref={pinAutRef} 
                type="password" 
                placeholder="PIN SUPERVISOR" 
                className="w-full py-3 bg-[#050a14] rounded-2xl text-center text-2xl font-black border-4 border-blue-600 text-white outline-none" 
                style={{ fontSize: '50%' }}
                onChange={e => setPinAutorizador(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && registrarAcceso()} 
                autoFocus 
              />
            )}
            
            <button onClick={registrarAcceso} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic shadow-2xl active:scale-95 transition-all">
              {animar ? '...' : 'CONFIRMAR'}
            </button>
            <button onClick={cancelar} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic">← CANCELAR</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
      `}</style>
    </main>
  );
}