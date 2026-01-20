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
      
      // DETERMINAR SI ES EMAIL O ID NUMÉRICO
      const esEmail = entrada.includes('@');
      const columnaBusqueda = esEmail ? 'email' : 'documento_id';

      // CONSULTA FLEXIBLE
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq(columnaBusqueda, entrada)
        .eq('pin_seguridad', pinLimpio)
        .maybeSingle();

      if (error) {
        console.error("Error DB:", error);
        alert("Error técnico en la base de datos.");
        setLoading(false);
        return;
      }

      if (!data) {
        // DIAGNÓSTICO DE FALLA
        const { data: existe } = await supabase
          .from('empleados')
          .select('nombre')
          .eq(columnaBusqueda, entrada)
          .maybeSingle();

        if (existe) {
          alert(`Usuario "${existe.nombre}" encontrado, pero el PIN es incorrecto.`);
        } else {
          alert(`No existe ningún usuario registrado con el ${esEmail ? 'correo' : 'ID'}: "${entrada}"`);
        }
        setLoading(false);
        return;
      }

      if (!data.activo) {
        alert("Usuario inactivo.");
        setLoading(false);
        return;
      }

      // PERSISTENCIA DE SESIÓN
      localStorage.setItem('user_session', JSON.stringify({
        id: data.id,
        nombre: data.nombre,
        rol: data.rol?.toLowerCase().trim() || 'empleado',
        documento_id: data.documento_id
      }));

      // REDIRECCIÓN POR ROL
      const rol = data.rol?.toLowerCase().trim();
      if (rol === 'admin' || rol === 'administrador') router.push('/admin');
      else if (rol === 'supervisor') router.push('/supervisor');
      else router.push('/empleado');

    } catch (err) {
      alert("Error de conexión");
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
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400 tracking-widest">Usuario o ID</label>
            <input 
              type="text" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all font-bold"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="Email o Cédula"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400 tracking-widest">PIN</label>
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
            className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] font-black uppercase italic tracking-widest mt-6 transition-all shadow-xl"
          >
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}