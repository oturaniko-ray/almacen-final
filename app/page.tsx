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
      const esEmail = entrada.includes('@');

      let empleadoData = null;

      if (esEmail) {
        // ESTRATEGIA A: Buscar en 'empleados' directamente por la columna email
        const { data: directo } = await supabase
          .from('empleados')
          .select('*')
          .eq('email', entrada)
          .eq('pin_seguridad', pinLimpio)
          .maybeSingle();

        if (directo) {
          empleadoData = directo;
        } else {
          // ESTRATEGIA B (Rescate): Buscar en 'profiles' y saltar a 'empleados'
          const { data: perfil } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', entrada)
            .maybeSingle();

          if (perfil) {
            const { data: relacional } = await supabase
              .from('empleados')
              .select('*')
              .eq('id', perfil.id)
              .eq('pin_seguridad', pinLimpio)
              .maybeSingle();
            empleadoData = relacional;
          }
        }
      } else {
        // ESTRATEGIA C: Búsqueda por documento_id
        const { data: documento } = await supabase
          .from('empleados')
          .select('*')
          .eq('documento_id', entrada)
          .eq('pin_seguridad', pinLimpio)
          .maybeSingle();
        empleadoData = documento;
      }

      // VALIDACIÓN FINAL
      if (!empleadoData) {
        alert(`No se encontró registro para "${entrada}". Verifique que el correo o ID sea correcto y que el PIN coincida.`);
        setLoading(false);
        return;
      }

      if (!empleadoData.activo) {
        alert("El usuario se encuentra inactivo.");
        setLoading(false);
        return;
      }

      // PERSISTENCIA DE SESIÓN
      localStorage.setItem('user_session', JSON.stringify({
        id: empleadoData.id,
        nombre: empleadoData.nombre,
        rol: empleadoData.rol?.toLowerCase().trim() || 'empleado',
        documento_id: empleadoData.documento_id
      }));

      // REDIRECCIÓN
      const rol = empleadoData.rol?.toLowerCase().trim();
      if (rol === 'admin' || rol === 'administrador') router.push('/admin');
      else if (rol === 'supervisor') router.push('/supervisor');
      else router.push('/empleado');

    } catch (err) {
      alert("Error de comunicación con el servidor.");
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
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400">Credenciales</label>
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

          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] font-black uppercase italic tracking-widest mt-6 transition-all shadow-lg">
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}