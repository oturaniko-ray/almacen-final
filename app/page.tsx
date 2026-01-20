'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<'login' | 'selector'>('login');
  const [tempUser, setTempUser] = useState<any>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const entrada = identificador.trim();
      const pinLimpio = pin.trim();
      const esEmail = entrada.includes('@');
      let empleadoData = null;

      // 1. Lógica de búsqueda (Email o ID)
      if (esEmail) {
        const { data: directo } = await supabase.from('empleados').select('*').eq('email', entrada).eq('pin_seguridad', pinLimpio).maybeSingle();
        if (directo) {
          empleadoData = directo;
        } else {
          const { data: perfil } = await supabase.from('profiles').select('id').eq('email', entrada).maybeSingle();
          if (perfil) {
            const { data: relacional } = await supabase.from('empleados').select('*').eq('id', perfil.id).eq('pin_seguridad', pinLimpio).maybeSingle();
            empleadoData = relacional;
          }
        }
      } else {
        const { data: documento } = await supabase.from('empleados').select('*').eq('documento_id', entrada).eq('pin_seguridad', pinLimpio).maybeSingle();
        empleadoData = documento;
      }

      if (!empleadoData) {
        alert("Credenciales incorrectas.");
        setLoading(false);
        return;
      }

      if (!empleadoData.activo) {
        alert("Usuario inactivo.");
        setLoading(false);
        return;
      }

      // Guardamos temporalmente para el selector
      const rolLimpio = empleadoData.rol?.toLowerCase().trim();
      const userSession = { ...empleadoData, rol: rolLimpio };
      setTempUser(userSession);
      localStorage.setItem('user_session', JSON.stringify(userSession));

      // 2. Bifurcación: Si es Empleado va directo, si tiene rango va al Selector
      if (rolLimpio === 'admin' || rolLimpio === 'administrador' || rolLimpio === 'supervisor') {
        setPaso('selector');
      } else {
        router.push('/empleado');
      }

    } catch (err) {
      alert("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  const irARuta = (ruta: string) => {
    router.push(ruta);
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 font-sans text-white">
      <div className="w-full max-w-sm bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-500">
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">
            SISTEMA <span className="text-blue-500">RAY</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">
            {paso === 'login' ? 'Control de Almacén' : 'Seleccione el Rol a ejecutar'}
          </p>
        </div>

        {paso === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-500">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase ml-4 text-slate-400">Correo Electrónico</label>
              <input 
                type="text" 
                className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all font-bold"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Email o Documento"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase ml-4 text-slate-400">PIN</label>
              <input 
                type="password" 
                className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all text-center text-3xl font-black"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="****"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] font-black uppercase italic mt-6 transition-all shadow-lg">
              {loading ? 'Sincronizando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
            <button onClick={() => irARuta('/empleado')} className="w-full bg-[#1e293b] hover:bg-emerald-600 p-6 rounded-[25px] font-bold text-lg transition-all border border-white/5">
              🏃 Acceso Empleado
            </button>
            
            <button onClick={() => irARuta('/supervisor')} className="w-full bg-[#1e293b] hover:bg-blue-600 p-6 rounded-[25px] font-bold text-lg transition-all border border-white/5">
              🛡️ Panel Supervisor
            </button>

            {(tempUser?.rol === 'admin' || tempUser?.rol === 'administrador') && (
              <button onClick={() => irARuta('/admin')} className="w-full bg-blue-700 hover:bg-blue-500 p-6 rounded-[25px] font-bold text-lg transition-all shadow-xl">
                ⚙️ Consola Admin
              </button>
            )}
            
            <button onClick={() => setPaso('login')} className="w-full p-2 text-[10px] font-black text-slate-500 uppercase mt-4">
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </main>
  );
}