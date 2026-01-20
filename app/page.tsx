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
      // Limpiamos espacios en blanco para evitar errores de tipeo
      const docLimpio = documento.trim();
      const pinLimpio = pin.trim();

      // CONSULTA DE VALIDACIÓN
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('documento_id', docLimpio)
        .eq('pin_seguridad', pinLimpio)
        .maybeSingle();

      if (error) {
        console.error("Error de Supabase:", error);
        alert(`Error de DB: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data) {
        // Diagnóstico: Verificamos si al menos el documento existe
        const { data: existeDoc } = await supabase
          .from('empleados')
          .select('documento_id')
          .eq('documento_id', docLimpio)
          .maybeSingle();

        if (existeDoc) {
          alert("El PIN es incorrecto.");
        } else {
          alert("El Documento ID no está registrado.");
        }
        setLoading(false);
        return;
      }

      if (!data.activo) {
        alert("Usuario inactivo. Contacte al administrador.");
        setLoading(false);
        return;
      }

      // GUARDAR SESIÓN
      const sessionData = {
        id: data.id,
        nombre: data.nombre,
        rol: data.rol ? data.rol.toLowerCase() : 'empleado',
        documento_id: data.documento_id
      };
      
      localStorage.setItem('user_session', JSON.stringify(sessionData));

      // REDIRECCIÓN LÓGICA
      if (sessionData.rol === 'admin' || sessionData.rol === 'administrador') {
        router.push('/admin');
      } else if (sessionData.rol === 'supervisor') {
        router.push('/supervisor');
      } else {
        router.push('/empleado');
      }

    } catch (err) {
      console.error("Error crítico:", err);
      alert("Error crítico de conexión.");
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
              placeholder="Ej: 123456"
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
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] text-white font-black uppercase italic tracking-widest mt-6 transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}