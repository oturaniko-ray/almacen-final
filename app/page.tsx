'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

// Definir el tipo de Empleado
interface Empleado {
  id: string;
  nombre: string;
  email: string;
  documento_id: string;
  nivel_acceso: number;
  permiso_reportes: boolean;
  rol: string;
  pin_seguridad: string;
  activo: boolean;
  telegram_token?: string;
  created_at?: string;
  updated_at?: string;
}

// SVG: Persona (usuario individual)
const IconPersona = () => (
  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);

// SVG: Camión / flota
const IconCamion = () => (
  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

const Notificacion = ({ mensaje, tipo, visible }: { mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null; visible: boolean }) => {
  if (!visible || !tipo) return null;
  const estilos = {
    exito: { barra: 'bg-emerald-500', card: 'border-emerald-500/20', etiq: 'text-emerald-400' },
    error: { barra: 'bg-rose-500', card: 'border-rose-500/20', etiq: 'text-rose-400' },
    advertencia: { barra: 'bg-amber-500', card: 'border-amber-500/20', etiq: 'text-amber-400' },
  };
  const etiquetas = { exito: 'CORRECTO', error: 'ERROR', advertencia: 'ATENCION' };
  const e = estilos[tipo];
  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-stretch min-w-[260px] max-w-[90vw] rounded-xl shadow-2xl overflow-hidden bg-[#0a0f1e] border animate-flash-fast ${e.card}`}>
      <div className={`w-[3px] flex-shrink-0 ${e.barra}`} />
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`text-[9px] font-black tracking-[0.2em] uppercase flex-shrink-0 ${e.etiq}`}>{etiquetas[tipo]}</span>
        <div className="w-px h-4 bg-white/10" />
        <span className="text-[11px] font-semibold text-white">{mensaje}</span>
      </div>
    </div>
  );
};

export default function HomePage() {
  const [modo, setModo] = useState<'seleccion' | 'login'>('seleccion');
  const [tipoAcceso, setTipoAcceso] = useState<'personal' | 'flota' | null>(null);
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  
  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Verificar si ya hay sesión
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      try {
        const user = JSON.parse(sessionData) as Empleado;
        if (user.nivel_acceso <= 2) router.replace('/empleado');
        else router.replace('/selector');
      } catch {
        // Si hay error, ignorar y mostrar login
      }
    }
  }, [router]);

  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 3000);
  };

  const handleSeleccion = (tipo: 'personal' | 'flota') => {
    setTipoAcceso(tipo);
    setModo('login');
    setTimeout(() => idRef.current?.focus(), 100);
  };

  const handleLogin = async () => {
    if (!identificador || !pin) {
      mostrarNotificacion('Complete todos los campos', 'advertencia');
      return;
    }
    setLoading(true);
    try {
      const pinUpper = pin.toUpperCase();

      // Buscar empleado por documento o email
      let { data: empleado, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
        .eq('pin_seguridad', pinUpper)
        .eq('activo', true)
        .maybeSingle();

      // Retrocompatibilidad con PIN antiguo
      if (!empleado && !error && pinUpper.startsWith('P') && pinUpper.length === 8) {
        const pinNuevo = 'E01' + pinUpper.substring(1);
        const res2 = await supabase
          .from('empleados')
          .select('*')
          .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
          .eq('pin_seguridad', pinNuevo)
          .eq('activo', true)
          .maybeSingle();
        empleado = res2.data;
        error = res2.error;
      }

      if (error || !empleado) throw new Error('Credenciales inválidas');

      // ✅ CASTEO EXPLÍCITO A Empleado
      const empleadoData = empleado as Empleado;

      // Guardar sesión en localStorage
      localStorage.setItem('user_session', JSON.stringify(empleadoData));

      // Redirigir según nivel de acceso
      if (empleadoData.nivel_acceso <= 2) router.push('/empleado');
      else router.push('/selector');

    } catch {
      mostrarNotificacion('Acceso denegado', 'error');
      setIdentificador('');
      setPin('');
      idRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de selección inicial
  if (modo === 'seleccion') {
    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
        <Notificacion mensaje={notificacion.mensaje} tipo={notificacion.tipo} visible={!!notificacion.tipo} />
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="w-full bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-6 text-center shadow-2xl">
            <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
              <span className="text-white">GESTOR DE </span>
              <span className="text-blue-700">ACCESO</span>
            </h1>
            <p className="text-white font-bold text-[17px] uppercase tracking-widest">
              SELECCIONE TIPO DE ACCESO
            </p>
          </div>

          <div className="w-full space-y-4">
            <button
              onClick={() => handleSeleccion('personal')}
              className="w-full bg-blue-600 hover:bg-blue-500 p-4 rounded-xl border border-white/5 active:scale-95 transition-all shadow-lg flex flex-col items-center justify-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
                <IconPersona />
              </div>
              <span className="text-white font-bold uppercase text-[13px] tracking-wider">
                ACCESO PERSONAL
              </span>
            </button>

            <button
              onClick={() => handleSeleccion('flota')}
              className="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-xl border border-white/5 active:scale-95 transition-all shadow-lg flex flex-col items-center justify-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
                <IconCamion />
              </div>
              <span className="text-white font-bold uppercase text-[13px] tracking-wider">
                ACCESO CONDUCTORES
              </span>
            </button>
          </div>

          <div className="w-full max-w-sm mt-8 pt-4 text-center">
            <p className="text-[9px] text-white/40 uppercase tracking-widest">
              @Copyright 2026
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Pantalla de login
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <Notificacion mensaje={notificacion.mensaje} tipo={notificacion.tipo} visible={!!notificacion.tipo} />
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-full bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl mx-auto">
          <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
            <span className="text-white">ACCESO </span>
            <span className="text-blue-700">{tipoAcceso === 'personal' ? 'PERSONAL' : 'CONDUCTORES'}</span>
          </h1>
          <p className="text-white font-bold text-[17px] uppercase tracking-widest mb-3">
            IDENTIFICACIÓN
          </p>
        </div>

        <div className="w-full bg-[#111111] p-8 rounded-[35px] border border-white/5 shadow-2xl space-y-4">
          <input
            ref={idRef}
            type="text"
            placeholder="DOCUMENTO / CORREO"
            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-[11px] font-bold text-white outline-none focus:border-blue-500/50 uppercase"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
            autoFocus
          />
          <input
            ref={pinRef}
            type="password"
            placeholder="PIN DE SEGURIDAD"
            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-[11px] font-black text-white tracking-[0.4em] outline-none focus:border-blue-500/50 uppercase"
            value={pin}
            onChange={(e) => setPin(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 p-4 rounded-xl text-white font-black uppercase italic text-sm active:scale-95 transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? 'VERIFICANDO...' : 'ENTRAR'}
          </button>
          <button
            onClick={() => {
              setModo('seleccion');
              setIdentificador('');
              setPin('');
            }}
            className="w-full text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] py-2 hover:text-white transition-all"
          >
            ← VOLVER
          </button>
        </div>
      </div>
    </main>
  );
}