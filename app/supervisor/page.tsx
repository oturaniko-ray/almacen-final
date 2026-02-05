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

  // --- CONFIG Y GPS REAL TIME ---
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
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setGps(prev => ({ ...prev, lat, lon }));
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  useEffect(() => {
    if (config.lat && gps.lat) {
      const d = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
      setGps(prev => ({ ...prev, dist: Math.round(d) }));
    }
  }, [gps.lat, gps.lon, config]);

  // --- LÓGICA DE CÁMARA ---
  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      const startCamera = async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start({ facingMode: "environment" }, { fps: 30, qrbox: 250 }, (decoded) => {
            const doc = procesarQR(decoded);
            if (doc) { setQrData(doc); setLecturaLista(true); scanner.stop(); }
          }, () => {});
        } catch (e) { showNotification("ERROR AL ACTIVAR CÁMARA", "error"); }
      };
      startCamera();
    }
    return () => { scannerRef.current?.stop().catch(() => {}); };
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
      showNotification("FUERA DE RANGO: ACÉRQUESE AL ALMACÉN", "error"); return;
    }
    setAnimar(true);
    const ahora = new Date().toISOString();

    try {
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq."${qrData}",email.eq."${qrData}"`).maybeSingle();
      if (!emp) throw new Error("EMPLEADO NO ENCONTRADO");
      if (!emp.activo) {
        showNotification("EMPLEADO NO ACTIVO EN EL SISTEMA", "warning");
        setTimeout(() => setModo('menu'), 3000); return;
      }
      
      if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) throw new Error("PIN TRABAJADOR INCORRECTO");

      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', String(pinAutorizador)).in('rol', ['supervisor', 'admin', 'Administrador']).maybeSingle();
      if (!aut) throw new Error("PIN ADMINISTRADOR INVÁLIDO");

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
      setModo('menu'); setDireccion(null); setQrData(''); setLecturaLista(false); setPinAutorizador(''); setPinEmpleado('');
    } catch (e: any) { 
      showNotification(e.message, "error");
      setQrData(''); setLecturaLista(false); // Reset para re-lectura
    } finally { setAnimar(false); }
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {mensaje.tipo && (
        <div className={`fixed top-10 z-[100] px-8 py-4 rounded-2xl font-black shadow-2xl animate-bounce ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 
          mensaje.tipo === 'warning' ? 'bg-amber-500 text-black animate-flash-fast' : 'bg-rose-600 text-white'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* MEMBRETE */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-8 rounded-[30px] border border-white/5 mb-4 text-center">
        <h1 className="text-2xl font-black italic uppercase text-white">PANEL DE LECTURA <span className="text-blue-700">QR</span></h1>
        {modo !== 'menu' && (
          <p className="text-blue-500 font-bold text-[11px] uppercase tracking-widest mt-1">
            {modo === 'usb' ? 'Lectura del QR por Scanner' : modo === 'camara' ? 'Lectura de QR por móvil' : 'Acceso Manual'}
          </p>
        )}
        {supervisorSesion && (
          <div className="pt-3 mt-3 border-t border-white/10 text-center">
            <p className="text-base text-white uppercase font-bold leading-tight">{supervisorSesion.nombre}</p>
            <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">NIVEL ACCESO: {supervisorSesion.nivel_acceso}</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[40px] border border-white/5 shadow-2xl relative">
        {modo === 'menu' ? (
          <div className="grid gap-4 w-full">
            <p className="text-[13px] font-bold uppercase tracking-[0.4em] text-white/30 text-center">Opciones</p>
            <button onClick={() => setModo('usb')} className="w-full bg-blue-600 p-7 rounded-2xl text-white font-black uppercase italic text-base active:scale-95 transition-all">🔌 SCANNER USB</button>
            <button onClick={() => setModo('camara')} className="w-full bg-emerald-600 p-7 rounded-2xl text-white font-black uppercase italic text-base active:scale-95 transition-all">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 p-7 rounded-2xl text-white font-black uppercase italic text-base border border-white/10 active:scale-95 transition-all">🖋️ MANUAL</button>
            <button onClick={() => router.push('/')} className="mt-4 text-emerald-500 font-bold uppercase text-[10px] tracking-widest text-center italic hover:text-white transition-colors">← Volver al menú anterior</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => setDireccion('entrada')} className="w-full py-8 bg-emerald-600 rounded-[30px] font-black text-4xl italic active:scale-95 transition-all shadow-lg">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-8 bg-red-600 rounded-[30px] font-black text-4xl italic active:scale-95 transition-all shadow-lg">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← VOLVER AL MENÚ ANTERIOR</button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {/* TELEMETRÍA GPS DETALLADA */}
            <div className="flex flex-col gap-1 px-4 py-3 bg-black/50 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-white/40 font-bold uppercase">Distancia Almacén:</span>
                <span className={`text-[10px] font-black ${gps.dist <= config.radio ? "text-emerald-500" : "text-rose-500"}`}>{gps.dist}m</span>
              </div>
              <div className="text-[8px] text-white/20 font-mono text-center">LAT: {gps.lat.toFixed(6)} | LON: {gps.lon.toFixed(6)}</div>
            </div>

            <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-60 flex items-center justify-center relative overflow-hidden`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && (
                      <input 
                        autoFocus 
                        className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full" 
                        placeholder="ESPERANDO SCANNER..." 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            const doc = procesarQR(val);
                            if (doc) { setQrData(doc); setLecturaLista(true); }
                            else (e.target as HTMLInputElement).value = '';
                          }
                        }} 
                      />
                    )}
                    {modo === 'manual' && (
                      <input 
                        autoFocus 
                        className="bg-transparent text-center text-xl font-black text-white outline-none w-full uppercase" 
                        placeholder="DOC O CORREO" 
                        value={qrData}
                        onChange={e => setQrData(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />
                    )}
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>
                  </>
                ) : <p className="text-emerald-500 font-black text-2xl uppercase italic animate-pulse">VALIDADO ✅</p>}
            </div>

            {/* INPUTS DE SEGURIDAD */}
            {modo === 'manual' && !lecturaLista && (
              <input 
                type="password" 
                placeholder="PIN DEL TRABAJADOR" 
                className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border-2 border-white/10 text-white outline-none"
                value={pinEmpleado}
                onChange={e => setPinEmpleado(e.target.value)}
              />
            )}

            {(lecturaLista || (modo === 'manual' && qrData && pinEmpleado)) && (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl text-center animate-flash-fast">
                   <p className="text-amber-500 text-[9px] font-black uppercase italic">⚠️ Requiere Validación Administrativa</p>
                </div>
                <input 
                  ref={pinAutRef} 
                  type="password" 
                  placeholder="PIN ADMINISTRADOR" 
                  className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-3xl font-black border-4 border-blue-600 text-white outline-none shadow-2xl" 
                  onChange={e => setPinAutorizador(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && registrarAcceso()} 
                  autoFocus 
                />
              </div>
            )}
            
            <button 
              onClick={registrarAcceso} 
              disabled={animar || !qrData || !pinAutorizador}
              className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic shadow-2xl disabled:opacity-30 active:scale-95 transition-all"
            >
              {animar ? 'PROCESANDO...' : 'CONFIRMAR'}
            </button>
            <button onClick={() => { setModo('menu'); setDireccion(null); setLecturaLista(false); setQrData(''); }} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic hover:text-white transition-colors">← CANCELAR OPERACIÓN</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
        @keyframes flash-fast { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .animate-flash-fast { animation: flash-fast 0.6s infinite; }
      `}</style>
    </main>
  );
}