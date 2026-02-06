'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<'login' | 'selector'>('login');
  const [tempUser, setTempUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ empresa_nombre: '', timer_inactividad: null });
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });

  const router = useRouter();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('*');
      if (data) {
        const confObj = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.clave]: curr.valor }), {});
        setConfig(confObj);
      }
    };
    fetchConfig();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .or(`documento_id.eq.${identificador},usuario.eq.${identificador}`)
      .eq('pin', pin)
      .eq('activo', true)
      .single();

    if (error || !data) {
      setMensaje({ texto: 'Credenciales inválidas', tipo: 'error' });
      setLoading(false);
      return;
    }

    setTempUser(data);
    localStorage.setItem('user_session', JSON.stringify(data));
    setPaso('selector');
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('user_session');
    setPaso('login');
    setIdentificador('');
    setPin('');
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="bg-[#111] p-8 rounded-[35px] border border-white/5 shadow-2xl space-y-4">
            <h2 className="text-white text-center font-black uppercase italic tracking-widest text-xl mb-6">Acceso Sistema</h2>
            <input 
              type="text" placeholder="USUARIO / ID" 
              className="w-full bg-black border border-white/10 p-4 rounded-xl text-white font-bold"
              value={identificador} onChange={(e) => setIdentificador(e.target.value)}
            />
            <input 
              type="password" placeholder="PIN SEGURIDAD" 
              className="w-full bg-black border border-white/10 p-4 rounded-xl text-white font-bold"
              value={pin} onChange={(e) => setPin(e.target.value)}
            />
            <button className="w-full bg-blue-600 p-4 rounded-xl text-white font-black uppercase italic">Entrar</button>
          </form>
        ) : (
          <div className="bg-[#111] p-8 rounded-[35px] border border-white/5 shadow-2xl space-y-3">
            <p className="text-white/40 text-[10px] font-black uppercase text-center mb-4">Bienvenido, {tempUser.nombre}</p>
            {[
              { label: '🏃 acceso empleado', ruta: '/empleado', minNivel: 1, color: 'bg-emerald-600' },
              { label: '🛡️ panel supervisor', ruta: '/supervisor', minNivel: 3, color: 'bg-blue-600' },
              { label: '📊 reportes y análisis', ruta: '/reportes', minNivel: 3, color: 'bg-slate-700' },
              { label: '👥 gestión personal', ruta: '/admin', minNivel: 5, color: 'bg-amber-600' },
            ].map((btn) => {
              if (Number(tempUser.nivel_acceso) < btn.minNivel) return null;
              return (
                <button 
                  key={btn.ruta} 
                  onClick={() => router.push(btn.ruta)}
                  className={`w-full ${btn.color} p-4 rounded-xl text-white font-bold uppercase italic text-[11px] flex items-center shadow-lg active:scale-95 transition-all`}
                >
                  {btn.label}
                </button>
              );
            })}
            <button onClick={logout} className="w-full text-red-500 font-bold uppercase text-[10px] pt-4 border-t border-white/5">Cerrar Sesión</button>
          </div>
        )}
      </div>
    </main>
  );
}