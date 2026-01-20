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
      const docLimpio = documento.trim();
      const pinLimpio = pin.trim();

      // 1. INTENTO DE BÚSQUEDA (Ajusta 'documento_id' si en tu DB se llama 'cedula' o 'identificacion')
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('documento_id', docLimpio)
        .eq('pin_seguridad', pinLimpio)
        .maybeSingle();

      if (error) {
        // Si sale este error, es que la columna 'documento_id' o 'pin_seguridad' NO EXISTEN con ese nombre
        console.error("Error de columnas:", error);
        alert(`Error técnico: Verifique que las columnas se llamen 'documento_id' y 'pin_seguridad'`);
        setLoading(false);
        return;
      }

      if (!data) {
        // Verificación de existencia simple para diagnóstico
        const { data: existe } = await supabase
          .from('empleados')
          .select('nombre')
          .eq('documento_id', docLimpio)
          .maybeSingle();

        if (existe) {
          alert(`Hola ${existe.nombre}, el PIN ingresado es incorrecto.`);
        } else {
          alert(`El ID ${docLimpio} no aparece en la base de datos.`);
        }
        setLoading(false);
        return;
      }

      if (data.activo === false) {
        alert("Usuario inactivo.");
        setLoading(false);
        return;
      }

      // GUARDAR SESIÓN
      localStorage.setItem('user_session', JSON.stringify({
        id: data.id,
        nombre: data.nombre,
        rol: data.rol?.toLowerCase() || 'empleado',
        documento_id: data.documento_id
      }));

      // REDIRECCIÓN
      const rol = data.rol?.toLowerCase();
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
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl text-white">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">SISTEMA <span className="text-blue-500">PRO</span></h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Acceso de Personal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400 tracking-widest">Identificación</label>
            <input 
              type="text" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all font-bold mt-1"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="Ingrese ID"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400 tracking-widest">PIN</label>
            <input 
              type="password" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all text-center text-2xl font-black mt-1"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="****"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] font-black uppercase italic tracking-widest mt-6 transition-all disabled:opacity-50"
          >
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}