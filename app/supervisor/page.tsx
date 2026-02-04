'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState(''); 
  const [pinEmpleado, setPinEmpleado] = useState(''); 
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [supervisorSesion, setSupervisorSesion] = useState<{nombre: string, rol: string} | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setSupervisorSesion(JSON.parse(sessionData));
  }, []);

  // CORRECCIÓN: Extrae el ID real del token Base64 generado en EmpleadoPage
  const procesarLecturaQR = (textoLeido: string) => {
    try {
      const decoded = atob(textoLeido);
      if (decoded.includes('|')) return decoded.split('|')[0]; // Extrae el documento_id real
      return textoLeido;
    } catch (e) {
      return textoLeido; // Si no es Base64, asume que es el ID directo (Manual/USB plano)
    }
  };

  const resetLectura = useCallback(async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData('');
    setPinEmpleado('');
    setPinAutorizador('');
    setLecturaLista(false);
    setAnimar(false);
    setDireccion(null); 
  }, []);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    try {
      // 1. BUSCAR AL EMPLEADO (Mapeo de datos para la inserción)
      const { data: emp, error: errEmp } = await supabase
        .from('empleados')
        .select('id, nombre, documento_id, pin_seguridad')
        .or(`documento_id.eq.${qrData},email.eq.${qrData}`)
        .maybeSingle();

      if (!emp) throw new Error("Empleado no existe en la base de datos");
      
      // Validar PIN del empleado si es manual
      if (modo === 'manual' && emp.pin_seguridad !== pinEmpleado) throw new Error("PIN de empleado incorrecto");

      // 2. VALIDAR AUTORIZADOR (Supervisor o Admin)
      const rolesPermitidos = modo === 'manual' ? ['admin', 'administrador'] : ['supervisor', 'admin', 'administrador'];
      const { data: validador } = await supabase
        .from('empleados')
        .select('nombre')
        .eq('pin_seguridad', pinAutorizador)
        .in('rol', rolesPermitidos)
        .maybeSingle();

      if (!validador) throw new Error(modo === 'manual' ? "Requiere PIN de Administrador" : "PIN Autorizador incorrecto");

      const firma = `${validador.nombre} (${modo.toUpperCase()})`;

      if (direccion === 'entrada') {
        // CORRECCIÓN: Usamos 'empleado_id' para el ID de relación y 'nombre_empleado' para el registro
        const { error: insErr } = await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, // ID interno de Supabase
          documento_id: emp.documento_id, // Documento físico
          nombre_empleado: emp.nombre,
          hora_entrada: new Date().toISOString(), 
          autoriza_entrada: firma,
          estado: 'activo' 
        }]);
        
        if (insErr) throw new Error(`Error DB: ${insErr.message}`);
        await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        alert(`✅ Entrada Registrada: ${emp.nombre}`);

      } else {
        // PROCESO DE SALIDA
        const { data: jActiva } = await supabase
          .from('jornadas')
          .select('*')
          .eq('empleado_id', emp.id)
          .is('hora_salida', null)
          .maybeSingle();

        if (!jActiva) throw new Error("No se encontró una entrada activa para este empleado");

        const ahora = new Date();
        const diffMs = ahora.getTime() - new Date(jActiva.hora_entrada).getTime();
        const horasDecimales = parseFloat((diffMs / 3600000).toFixed(2));

        const { error: updErr } = await supabase.from('jornadas').update({ 
          hora_salida: ahora.toISOString(), 
          horas_trabajadas: horasDecimales,
          autoriza_salida: firma,
          estado: 'finalizado'
        }).eq('id', jActiva.id);

        if (updErr) throw updErr;
        await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        alert(`✅ Salida Registrada: ${emp.nombre}`);
      }

      resetLectura();
    } catch (err: any) { 
      alert(`❌ ERROR: ${err.message}`); 
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 italic">Panel Supervisor</h2>
          {modo !== 'menu' && (
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
              Sesión: {supervisorSesion?.nombre} | Modo: {modo.toUpperCase()}
            </p>
          )}
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-blue-600 transition-all">🔌 Scanner / USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-emerald-600 transition-all">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-slate-700 transition-all">🖋️ Entrada Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl italic">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl italic">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-slate-500 uppercase text-[10px]">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`bg-[#050a14] p-4 rounded-[30px] border ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} h-56 flex items-center justify-center overflow-hidden relative`}>
              {!lecturaLista ? (
                <>
                  {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                  {modo === 'usb' && (
                    <input type="text" className="opacity-0 absolute" autoFocus onChange={(e) => { setQrData(procesarLecturaQR(e.target.value)); setLecturaLista(true); }} />
                  )}
                  {modo === 'manual' && (
                    <input type="text" placeholder="ID EMPLEADO" className="bg-transparent text-center text-xl font-black outline-none w-full" autoFocus onKeyDown={(e) => { if(e.key === 'Enter') { setQrData(e.currentTarget.value); }}} />
                  )}
                </>
              ) : (
                <p className="text-emerald-500 font-black text-xl italic">IDENTIDAD: {qrData}</p>
              )}
            </div>

            {modo === 'manual' && qrData && !lecturaLista && (
              <input type="password" placeholder="PIN EMPLEADO" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/10 outline-none" value={pinEmpleado} onChange={e => setPinEmpleado(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') setLecturaLista(true); }} />
            )}

            {lecturaLista && (
              <input ref={pinAutRef} type="password" placeholder="PIN AUTORIZADOR" className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500 outline-none shadow-[0_0_15px_rgba(59,130,246,0.5)]" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') registrarAcceso(); }} autoFocus />
            )}

            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-3xl font-black uppercase italic shadow-lg hover:bg-blue-500 disabled:opacity-30">
              {animar ? 'REGISTRANDO...' : 'Confirmar Registro'}
            </button>
            <button onClick={resetLectura} className="w-full text-center text-slate-500 uppercase text-[10px]">✕ Cancelar</button>
          </div>
        )}
      </div>
    </main>
  );
}