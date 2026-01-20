'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function LoginPage() {
  const [identificador, setIdentificador] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const entrada = identificador.trim();
      const pinLimpio = pin.trim();
      
      let usuarioEncontrado = null;

      if (entrada.includes('@')) {
        // 1. Si es correo, buscamos primero en la tabla PROFILES (según tu captura)
        const { data: perfil, error: errPerfil } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', entrada) // Verifica si en profiles la columna es 'email' o 'correo'
          .maybeSingle();

        if (perfil) {
          // 2. Si hallamos el perfil, buscamos sus datos de empleado por ID
          const { data: emp } = await supabase
            .from('empleados')
            .select('*')
            .eq('id', perfil.id)
            .eq('pin_seguridad', pinLimpio)
            .maybeSingle();
          usuarioEncontrado = emp;
        }
      } else {
        // 3. Si es ID numérico, buscamos directo en EMPLEADOS
        const { data: emp } = await supabase
          .from('empleados')
          .select('*')
          .eq('documento_id', entrada)
          .eq('pin_seguridad', pinLimpio)
          .maybeSingle();
        usuarioEncontrado = emp;
      }

      if (!usuarioEncontrado) {
        alert("Credenciales incorrectas o usuario no encontrado en la base de datos de personal.");
        setLoading(false);
        return;
      }

      if (!usuarioEncontrado.activo) {
        alert("Usuario inactivo.");
        setLoading(false);
        return;
      }

      // PERSISTENCIA DE SESIÓN
      localStorage.setItem('user_session', JSON.stringify({
        id: usuarioEncontrado.id,
        nombre: usuarioEncontrado.nombre,
        rol: usuarioEncontrado.rol?.toLowerCase().trim(),
        documento_id: usuarioEncontrado.documento_id
      }));

      // REDIRECCIÓN
      const rol = usuarioEncontrado.rol?.toLowerCase().trim();
      if (rol === 'admin' || rol === 'administrador') router.push('/admin');
      else if (rol === 'supervisor') router.push('/supervisor');
      else router.push('/empleado');

    } catch (err) {
      console.error(err);
      alert("Error crítico de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 font-sans text-white">
      <div className="w-full max-w-sm bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">
            SISTEMA <span className="text-blue-500">PRO</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Control de Almacén</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400">Usuario o ID</label>
            <input 
              type="text" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all font-bold"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="Email o Identificación"
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

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] font-black uppercase italic tracking-widest mt-6 transition-all"
          >
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}