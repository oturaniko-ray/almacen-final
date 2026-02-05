'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Función de cálculo Haversine para validación de rango
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
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | 'warning' | null }>({ texto: '', tipo: null });
  const [supervisorSesion, setSupervisorSesion] = useState<any>(null);
  const [config, setConfig] = useState<any>({ timer_inactividad: 120000, qr_expiracion: 30000 });
  const [gpsOk, setGpsOk] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const inputUsbRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const showNotification = (texto: string, tipo: 'success' | 'error' | 'warning') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  // --- CARGA DE CONFIGURACIÓN Y GPS ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setSupervisorSesion(JSON.parse(sessionData));

    const initSupervisor = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        const newCfg = {
          lat: parseFloat(cfgMap.latitud_almacen),
          lon: parseFloat(cfgMap.longitud_almacen),
          radio: parseFloat(cfgMap.radio_permitido) || 100,
          timer: parseInt(cfgMap.timer_inactividad) || 120000,
          qr_exp: parseInt(cfgMap.qr_expiracion) || 30000,
          empresa: cfgMap.empresa_nombre
        };
        setConfig(newCfg);

        // Validar ubicación del supervisor
        navigator.geolocation.getCurrentPosition((pos) => {
          const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, newCfg.lat, newCfg.lon);
          if (dist <= newCfg.radio) setGpsOk(true);
          else showNotification("FUERA DE RANGO GEOGRÁFICO", 'error');
        }, () => showNotification("ERROR GPS: ACTIVA LA UBICACIÓN", 'error'));
      }
    };
    initSupervisor();
  }, [router]);

  const handleLogout = () => { localStorage.clear(); router.push('/'); };

  const procesarLectura = (texto: string) => {
    try {
      const decoded = atob(texto);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        if (Date.now() - parseInt(timestamp) > config.qr_exp) {
          showNotification("CÓDIGO QR EXPIRADO", 'error'); return '';
        }
        return docId;
      }
      return texto;
    } catch { return texto; }
  };

  const registrarAcceso = async () => {
    if (!gpsOk) { showNotification("UBICACIÓN NO VÁLIDA", 'error'); return; }
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    const ahora = new Date().toISOString();

    try {
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq."${qrData}",email.eq."${qrData}"`).maybeSingle();
      if (!emp) throw new Error("Empleado no encontrado");
      if (!emp.activo) {
        showNotification("EMPLEADO NO REGISTRADO COMO ACTIVO", 'warning');
        setTimeout(() => setModo('menu'), 3000); return;
      }

      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', String(pinAutorizador)).in('rol', ['supervisor', 'admin', 'Administrador']).maybeSingle();
      if (!aut) throw new Error("PIN AUTORIZADOR INVÁLIDO");

      const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

      if (direccion === 'entrada') {
        await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: ahora, autoriza_entrada: firma, estado: 'activo' }]);
        await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
      } else {
        const { data: j } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
        if (!j) throw new Error("No hay entrada activa");
        const horas = parseFloat(((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2));
        await supabase.from('jornadas').update({ hora_salida: ahora, horas_trabajadas: horas, autoriza_salida: firma, estado: 'finalizado' }).eq('id', j.id);
        await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
      }

      showNotification("REGISTRO EXITOSO", 'success');
      setModo('menu'); setDireccion(null); setQrData(''); setLecturaLista(false); setPinAutorizador('');
    } catch (err: any) { showNotification(err.message, 'error'); } finally { setAnimar(false); }
  };

  const getSubtitulo = () => {
    if (modo === 'usb') return "Lectura del QR por Scanner";
    if (modo === 'camara') return "Lectura de QR por móvil";
    if (modo === 'manual') return "Acceso manual";
    return "";
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {mensaje.tipo && (
        <div className={`fixed top-10 z-[100] px-8 py-4 rounded-2xl font-black animate-bounce shadow-2xl ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 
          mensaje.tipo === 'warning' ? 'bg-amber-500 text-black' : 'bg-rose-600 text-white'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* MEMBRETE REDISEÑADO */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-8 rounded-[30px] border border-white/5 mb-4 text-center">
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1">
          PANEL DE LECTURA <span className="text-blue-700">QR</span>
        </h1>
        {modo !== 'menu' && <p className="text-blue-500 font-bold text-sm uppercase mb-3">{getSubtitulo()}</p>}
        {supervisorSesion && (
          <div className="pt-3 border-t border-white/10 flex flex-col items-center">
            <span className="text-base text-white uppercase font-bold">{supervisorSesion.nombre}</span>
            <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">NIVEL ACCESO: {supervisorSesion.nivel_acceso}</span>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[40px] border border-white/5 shadow-2xl">
        {modo === 'menu' ? (
          <div className="grid gap-4 w-full">
            <div className="text-center mb-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.4em] text-white animate-pulse-very-slow">Opciones</p>
            </div>
            {/* Botones +15% de tamaño de fuente */}
            <button onClick={() => setModo('usb')} className="w-full bg-blue-600 p-7 rounded-2xl text-white font-black uppercase italic text-base shadow-xl active:scale-95 transition-all">🔌 SCANNER USB</button>
            <button onClick={() => setModo('camara')} className="w-full bg-emerald-600 p-7 rounded-2xl text-white font-black uppercase italic text-base shadow-xl active:scale-95 transition-all">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 p-7 rounded-2xl text-white font-black uppercase italic text-base border border-white/10 active:scale-95 transition-all">🖋️ MANUAL</button>
            <button onClick={handleLogout} className="mt-4 text-emerald-500 font-bold uppercase text-[10px] tracking-widest text-center italic">← Volver al menú anterior</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => setDireccion('entrada')} className="w-full py-8 bg-emerald-600 rounded-[30px] font-black text-4xl italic active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-8 bg-red-600 rounded-[30px] font-black text-4xl italic active:scale-95 transition-all">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← VOLVER AL MENÚ ANTERIOR</button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-60 flex items-center justify-center relative overflow-hidden`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && <input autoFocus className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full" placeholder="ESPERANDO SCANNER..." onChange={e => { setQrData(procesarLectura(e.target.value)); setLecturaLista(true); }} />}
                    {modo === 'manual' && <input className="bg-transparent text-center text-2xl font-black text-white outline-none w-full" placeholder="DOCUMENTO ID" onChange={e => setQrData(e.target.value)} onKeyDown={e => e.key === 'Enter' && setLecturaLista(true)} />}
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>
                  </>
                ) : <p className="text-emerald-500 font-black text-2xl uppercase italic">ID CAPTURADO ✅</p>}
            </div>
            {lecturaLista && <input ref={pinAutRef} type="password" placeholder="PIN AUTORIZADOR" className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-3xl font-black border-4 border-blue-600 text-white outline-none" onChange={e => setPinAutorizador(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarAcceso()} />}
            <button onClick={registrarAcceso} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic shadow-2xl">{animar ? '...' : 'CONFIRMAR'}</button>
            <button onClick={() => setLecturaLista(false)} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic">← VOLVER AL MENÚ ANTERIOR</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
        @keyframes pulse-very-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        .animate-pulse-very-slow { animation: pulse-very-slow 6s ease-in-out infinite; }
      `}</style>
    </main>
  );
}