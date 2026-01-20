'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [documento, setDocumento] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // BUSQUEDA UNIFICADA EN TABLA EMPLEADOS
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('documento_id', documento.trim())
        .eq('pin_seguridad', pin.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert("Credenciales incorrectas");
        setLoading(false);
        return;
      }

      if (!data.activo) {
        alert("El usuario se encuentra inactivo. Contacte al administrador.");
        setLoading(false);
        return;
      }

      // GUARDAR SESIÓN CON ESTRUCTURA UNIFICADA
      const sessionData = {
        id: data.id,
        nombre: data.nombre,
        rol: data.rol.toLowerCase(),
        documento_id: data.documento_id
      };
      
      localStorage.setItem('user_session', JSON.stringify(sessionData));

      // REDIRECCIÓN SEGÚN ROL
      if (sessionData.rol === 'admin' || sessionData.rol === 'administrador') {
        router.push('/admin');
      } else if (sessionData.rol === 'supervisor') {
        router.push('/supervisor');
      } else {
        router.push('/empleado');
      }

    } catch (err) {
      console.error(err);
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            SISTEMA <span className="text-blue-500">PRO</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Control de Almacén</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400">Documento ID</label>
            <input 
              type="text" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] text-white outline-none focus:border-blue-500 transition-all font-bold"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="00000000"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400">PIN de Seguridad</label>
            <input 
              type="password" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] text-white outline-none focus:border-blue-500 transition-all text-center text-2xl tracking-[0.5em] font-black"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="****"
              maxLength={6}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] text-white font-black uppercase italic tracking-widest mt-6 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Seguridad Biométrica & GPS Activa</p>
        </div>
      </div>
    </main>
  );
}