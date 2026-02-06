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
  const [config, setConfig] = useState<any>({ empresa_nombre: 'SISTEMA', timer_inactividad: null });
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });

  const idRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
      setTempUser(user);
      setPaso('selector');
    }
  }, []);

  const handleLogin = async () => {
    if (!identificador || !pin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('employees')
        .select('*')
        .or(`documento_id.eq.${identificador},email.ilike.${identificador.trim()}`)
        .eq('pin_seguridad', pin).eq('activo', true).maybeSingle();

      if (error || !data) throw new Error("Acceso Denegado");
      
      localStorage.setItem('user_session', JSON.stringify(data));
      setTempUser(data);
      setPaso('selector');
    } catch (err: any) {
      setMensaje({ texto: "Credenciales Incorrectas", tipo: 'error' });
      setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center text-white">
        <h1 className="text-xl font-black italic uppercase">{config.empresa_nombre}</h1>
      </div>
      
      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5">
        {paso === 'login' ? (
          <div className="space-y-4">
            <input 
              type="text" placeholder="ID / CORREO" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" 
              value={identificador} onChange={(e) => setIdentificador(e.target.value)}
            />
            <input 
              type="password" placeholder="PIN" 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-blue-500" 
              value={pin} onChange={(e) => setPin(e.target.value)} 
            />
            <button onClick={handleLogin} className="w-full bg-blue-600 p-4 rounded-xl text-white font-bold uppercase shadow-lg">
              {loading ? '...' : 'Entrar'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { label: '🏃 acceso empleado', ruta: '/empleado', minNivel: 1, color: 'bg-emerald-600' },
              { label: '📊 reportes y análisis', ruta: '/reportes', minNivel: 3, color: 'bg-slate-700' },
              { label: '⚙️ config. maestra', ruta: '/configuracion', minNivel: 8, color: 'bg-rose-900' },
            ].map((btn) => {
              if (Number(tempUser?.nivel_acceso) < btn.minNivel) return null;
              return (
                <button 
                  key={btn.ruta} onClick={() => router.push(btn.ruta)} 
                  className={`w-full ${btn.color} p-4 rounded-xl text-white font-bold uppercase text-[11px]`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}