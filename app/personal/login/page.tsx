'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const formatearRol = (rol: string): string => {
  if (!rol) return 'EMPLEADO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin':
    case 'administrador':
      return 'ADMINISTRADOR';
    case 'supervisor':
      return 'SUPERVISOR';
    case 'tecnico':
      return 'TÉCNICO';
    case 'empleado':
      return 'EMPLEADO';
    default:
      return rol.toUpperCase();
  }
};

const MemebreteSuperior = () => (
  <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl mx-auto">
    <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
      <span className="text-white">ACCESO </span>
      <span className="text-blue-700">PERSONAL</span>
    </h1>
    <p className="text-white font-bold text-[17px] uppercase tracking-widest mb-3">
      IDENTIFICACIÓN DE EMPLEADO
    </p>
  </div>
);

const Notificacion = ({ mensaje, tipo, visible }: { mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null; visible: boolean }) => {
  if (!visible) return null;
  const colores = {
    exito: 'bg-emerald-500 border-emerald-400',
    error: 'bg-rose-500 border-rose-400',
    advertencia: 'bg-amber-500 border-amber-400',
  };
  const iconos = {
    exito: '✅',
    error: '❌',
    advertencia: '⚠️',
  };
  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl font-bold text-sm shadow-2xl animate-flash-fast max-w-[90%] text-center border-2 ${colores[tipo!]} text-white flex items-center gap-3`}>
      <span className="text-lg">{iconos[tipo!]}</span>
      <span>{mensaje}</span>
    </div>
  );
};

export default function PersonalLoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });

  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (session) {
      const user = JSON.parse(session);
      if (Number(user.nivel_acceso) <= 2) router.replace('/empleado');
      else router.replace('/selector');
    }
  }, [router]);

  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 3000);
  };

  const handleLogin = async () => {
    if (!identificador || !pin) {
      mostrarNotificacion('Complete todos los campos', 'advertencia');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
        .eq('pin_seguridad', pin)
        .eq('activo', true)
        .maybeSingle();

      if (error || !data) throw new Error('Credenciales inválidas');

      // ✅ SOLUCIÓN: Verificar que data es un objeto antes de hacer spread
      if (data && typeof data === 'object') {
        const userData = {
          ...(data as any),
          nivel_acceso: Number((data as any).nivel_acceso),
          permiso_reportes: !!((data as any).permiso_reportes),
        };
        
        localStorage.setItem('user_session', JSON.stringify(userData));

        if (userData.nivel_acceso <= 2) router.push('/empleado');
        else router.push('/selector');
      } else {
        throw new Error('Datos de usuario inválidos');
      }
    } catch {
      mostrarNotificacion('Acceso denegado', 'error');
      setIdentificador('');
      setPin('');
      idRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <Notificacion mensaje={notificacion.mensaje} tipo={notificacion.tipo} visible={!!notificacion.tipo} />
      <div className="w-full max-w-sm flex flex-col items-center">
        <MemebreteSuperior />
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
        </div>
        <div className="mt-6 text-center">
          <button onClick={() => router.push('/')} className="text-blue-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all">
            ← VOLVER AL INICIO
          </button>
        </div>
      </div>
      <style jsx global>{`
        @keyframes flash-fast { 0%,100%{opacity:1} 10%,30%,50%{opacity:0} 20%,40%,60%{opacity:1} }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
      `}</style>
    </main>
  );
}