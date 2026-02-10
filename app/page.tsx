'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
// Mantén las importaciones como están:
import MembreteSuperior from './configuracion/componentes/MembreteSuperior';
import BotonAcceso from './configuracion/componentes/BotonAcceso';
import NotificacionSistema from './configuracion/componentes/NotificacionSistema';
import CampoEntrada from './configuracion/componentes/CampoEntrada';
import ContenedorPrincipal from './configuracion/componentes/ContenedorPrincipal';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<'login' | 'selector'>('login');
  const [tempUser, setTempUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ empresa_nombre: '', timer_inactividad: null });
  const [notificacion, setNotificacion] = useState<{ 
    mensaje: string; 
    tipo: 'exito' | 'error' | 'advertencia' | 'info' | null 
  }>({ mensaje: '', tipo: null });

  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- LÓGICA DE INACTIVIDAD ---
  const reiniciarTemporizador = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (config.timer_inactividad) {
      const tiempoLimite = parseInt(config.timer_inactividad);
      
      if (!isNaN(tiempoLimite)) {
        timerRef.current = setTimeout(() => {
          if (paso === 'selector') {
            logout();
            mostrarNotificacion("Sesión cerrada por inactividad", 'error');
          }
        }, tiempoLimite);
      }
    }
  };

  useEffect(() => {
    if (paso === 'selector' && config.timer_inactividad) {
      const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      eventos.forEach(evento => document.addEventListener(evento, reiniciarTemporizador));
      reiniciarTemporizador();

      return () => {
        eventos.forEach(evento => document.removeEventListener(evento, reiniciarTemporizador));
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [paso, config.timer_inactividad]);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig((prev: any) => ({ ...prev, ...cfgMap }));
      }
    };
    fetchConfig();
    
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      const user = JSON.parse(sessionData);
      const nivel = Number(user.nivel_acceso);
      
      if (nivel <= 2) {
        router.push('/empleado');
      } else {
        setTempUser(user);
        setPaso('selector');
      }
    }
  }, [router]);

  const logout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.clear();
    setTempUser(null);
    setIdentificador('');
    setPin('');
    setPaso('login');
  };

  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia' | 'info') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 3000);
  };

  const handleLogin = async () => {
    if (!identificador || !pin) {
      mostrarNotificacion("Complete todos los campos", 'advertencia');
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.from('empleados')
        .select('*')
        .or(`documento_id.eq."${identificador}",email.eq."${identificador.toLowerCase()}"`)
        .eq('pin_seguridad', pin).eq('activo', true).maybeSingle();

      if (error || !data) throw new Error("Credenciales inválidas");
      
      const userData = { 
        ...data, 
        nivel_acceso: Number(data.nivel_acceso),
        permiso_reportes: !!data.permiso_reportes 
      };
      
      localStorage.setItem('user_session', JSON.stringify(userData));
      const nivel = userData.nivel_acceso;

      if (nivel <= 2) {
        router.push('/empleado');
      } else {
        setTempUser(userData);
        setPaso('selector');
      }
    } catch (err: any) {
      mostrarNotificacion("Acceso denegado", 'error');
      setIdentificador(''); 
      setPin('');
      idRef.current?.focus();
    } finally { 
      setLoading(false); 
    }
  };

  const obtenerBotonesDisponibles = () => {
    const nivel = Number(tempUser?.nivel_acceso || 0);
    const tienePermisoReportes = tempUser?.permiso_reportes === true;
    
    const todosLosBotones = [
      { 
        label: 'ACCESO EMPLEADO', 
        icono: '🫆', 
        ruta: '/empleado', 
        minNivel: 1, 
        tipo: 'exito' as const 
      },
      { 
        label: 'PANEL SUPERVISOR', 
        icono: '🕖', 
        ruta: '/supervisor', 
        minNivel: 3, 
        tipo: 'primario' as const 
      },
      { 
        label: 'REPORTES Y ANÁLISIS', 
        icono: '📊', 
        ruta: '/reportes', 
        minNivel: 3, 
        tipo: 'neutral' as const,
        requiereReportes: true 
      },
      { 
        label: 'GESTIÓN PERSONAL', 
        icono: '👥', 
        ruta: '/admin', 
        minNivel: 4, 
        tipo: 'secundario' as const 
      },
      { 
        label: 'CONFIGURACIÓN MAESTRA', 
        icono: '👨‍🔧', 
        ruta: '/configuracion', 
        minNivel: 8, 
        tipo: 'peligro' as const 
      },
    ];
    
    return todosLosBotones.filter((btn) => {
      if (nivel < btn.minNivel) return false;
      if (btn.requiereReportes && !tienePermisoReportes) return false;
      
      if (nivel === 3) {
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor';
      }
      
      if (nivel === 4) {
        if (btn.ruta === '/reportes') return tienePermisoReportes;
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor' || btn.ruta === '/admin';
      }
      
      if (nivel === 5) {
        return btn.ruta !== '/configuracion';
      }
      
      if (nivel >= 6 && nivel <= 7) {
        return btn.ruta !== '/configuracion';
      }
      
      return true;
    });
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      <NotificacionSistema 
        mensaje={notificacion.mensaje} 
        tipo={notificacion.tipo || 'info'} 
        visible={!!notificacion.tipo} 
      />

      <MembreteSuperior 
        titulo={config.empresa_nombre || 'SISTEMA DE CONTROL'}
        subtitulo={paso === 'login' ? 'IDENTIFICACIÓN' : 'MENÚ PRINCIPAL'}
        usuario={tempUser}
        conAnimacion={paso === 'login'}
        mostrarUsuario={!!tempUser}
      />
      
      <ContenedorPrincipal>
        {paso === 'login' ? (
          <div className="space-y-4">
            <CampoEntrada 
              tipo="text"
              placeholder="ID / CORREO"
              valor={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              referencia={idRef}
              autoFocus={true}
              onEnter={() => pinRef.current?.focus()}
            />
            
            <CampoEntrada 
              tipo="password"
              placeholder="PIN DE SEGURIDAD"
              valor={pin}
              onChange={(e) => setPin(e.target.value)}
              referencia={pinRef}
              onEnter={handleLogin}
            />
            
            <BotonAcceso 
              texto={loading ? 'VERIFICANDO...' : 'ENTRAR AL SISTEMA'}
              icono="🔐"
              tipo="primario"
              onClick={handleLogin}
              disabled={loading}
              loading={loading}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center mb-6">
              <p className="text-[13px] font-bold uppercase tracking-[0.4em] text-white/20 animate-pulse-very-slow">
                OPCIONES DISPONIBLES
              </p>
            </div>

            {obtenerBotonesDisponibles().map((btn) => (
              <BotonAcceso 
                key={btn.ruta}
                texto={btn.label}
                icono={btn.icono}
                tipo={btn.tipo}
                onClick={() => router.push(btn.ruta)}
              />
            ))}
            
            <button 
              onClick={logout}
              className="w-full text-emerald-500 font-bold uppercase text-[11px] tracking-[0.2em] mt-6 italic text-center py-2 border-t border-white/5 hover:text-emerald-400 transition-colors"
            >
              ✕ CERRAR SESIÓN
            </button>
          </div>
        )}
      </ContenedorPrincipal>
    </main>
  );
}