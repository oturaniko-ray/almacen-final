'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<'login' | 'selector'>('login');
  const [tempUser, setTempUser] = useState<any>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });

  const router = useRouter();

  // --- PERSISTENCIA Y CARGA INICIAL ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      setTempUser(JSON.parse(sessionData));
      setPaso('selector');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const idLimpio = identificador.trim();
    const pinLimpio = pin.trim();

    if (!idLimpio || !pinLimpio) {
      setMensaje({ texto: 'Complete Documento/Email y PIN', tipo: 'error' });
      return;
    }
    
    setLoading(true);
    setMensaje({ texto: '', tipo: null });

    try {
      // Búsqueda en tabla 'empleados' por documento_id o email
      // .ilike permite que no importe si escriben en Mayúsculas o Minúsculas
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .or(`documento_id.ilike.${idLimpio},email.ilike.${idLimpio}`)
        .eq('pin', pinLimpio)
        .eq('activo', true)
        .maybeSingle();

      if (error) {
        console.error("Error DB:", error.message);
        setMensaje({ texto: 'Error de conexión con la base de datos', tipo: 'error' });
        return;
      }

      if (!data) {
        setMensaje({ texto: 'Credenciales inválidas o personal inactivo', tipo: 'error' });
      } else {
        setTempUser(data);
        localStorage.setItem('user_session', JSON.stringify(data));
        setPaso('selector');
      }
    } catch (err) {
      setMensaje({ texto: 'Error crítico en el inicio de sesión', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('user_session');
    setTempUser(null);
    setIdentificador('');
    setPin('');
    setPaso('login');
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Glow de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="bg-[#111] p-8 rounded-[35px] border border-white/5 shadow-2xl space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-white font-black uppercase italic tracking-[0.2em] text-xl">Acceso Sistema</h2>
              <p className="text-blue-500 text-[9px] font-black mt-2 uppercase tracking-widest">Verificación de Credenciales</p>
            </div>
            
            {mensaje.texto && (
              <div className={`p-4 rounded-xl text-center text-[10px] font-black uppercase border ${
                mensaje.tipo === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                {mensaje.texto}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] text-white/30 font-black uppercase ml-2 tracking-widest">Documento o Email</label>
              <input 
                type="text" 
                placeholder="ID / CORREO" 
                className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white font-bold focus:border-blue-600 outline-none transition-all placeholder:text-white/5"
                value={identificador} 
                onChange={(e) => setIdentificador(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-white/30 font-black uppercase ml-2 tracking-widest">PIN Personal</label>
              <input 
                type="password" 
                placeholder="••••" 
                className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white font-bold focus:border-blue-600 outline-none transition-all placeholder:text-white/5 text-center tracking-[0.5em]"
                value={pin} 
                onChange={(e) => setPin(e.target.value)}
                disabled={loading}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 p-5 rounded-2xl text-white font-black uppercase italic text-[11px] tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-600/20"
            >
              {loading ? 'Validando...' : 'Entrar al Sistema'}
            </button>
          </form>
        ) : (
          <div className="bg-[#111] p-8 rounded-[35px] border border-white/5 shadow-2xl space-y-3">
            <div className="text-center mb-6">
              <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Usuario Identificado</p>
              <h3 className="text-white text-xl font-black uppercase italic truncate">{tempUser?.nombre}</h3>
            </div>

            <div className="space-y-2">
              {[
                { label: '🏃 acceso empleado', ruta: '/empleado', minNivel: 1, color: 'bg-emerald-600' },
                { label: '🛡️ panel supervisor', ruta: '/supervisor', minNivel: 3, color: 'bg-blue-600' },
                { label: '📊 reportes y análisis', ruta: '/reportes', minNivel: 3, color: 'bg-slate-700' },
                { label: '👥 gestión personal', ruta: '/admin', minNivel: 5, color: 'bg-amber-600' },
                { label: '⚙️ config. maestra', ruta: '/configuracion', minNivel: 8, color: 'bg-rose-900' },
              ].map((btn) => {
                if (Number(tempUser?.nivel_acceso) < btn.minNivel) return null;
                return (
                  <button 
                    key={btn.ruta} 
                    onClick={() => router.push(btn.ruta)}
                    className={`w-full ${btn.color} p-4 rounded-2xl text-white font-black uppercase italic text-[10px] flex items-center justify-between shadow-lg hover:brightness-110 active:scale-95 transition-all`}
                  >
                    <span>{btn.label}</span>
                    <span className="opacity-40">→</span>
                  </button>
                );
              })}
            </div>

            <button 
              onClick={logout} 
              className="w-full text-white/20 hover:text-red-500 font-black uppercase text-[9px] tracking-[0.2em] pt-6 border-t border-white/5 transition-colors mt-4"
            >
              ✕ Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </main>
  );
}