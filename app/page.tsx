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
      // 1. Limpieza rigurosa de datos para evitar fallos de coincidencia
      const docLimpio = documento.trim();
      const pinLimpio = pin.trim();

      // 2. Consulta a la tabla empleados (según tu captura)
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('documento_id', docLimpio)
        .eq('pin_seguridad', pinLimpio)
        .maybeSingle();

      if (error) {
        console.error("Error Supabase:", error);
        alert("Error de conexión con la base de datos.");
        setLoading(false);
        return;
      }

      // 3. Lógica de diagnóstico si no encuentra al usuario
      if (!data) {
        const { data: existeDoc } = await supabase
          .from('empleados')
          .select('nombre')
          .eq('documento_id', docLimpio)
          .maybeSingle();

        if (existeDoc) {
          alert(`Hola ${existeDoc.nombre}, el PIN de seguridad es incorrecto.`);
        } else {
          alert("La identificación ingresada no está registrada en el sistema.");
        }
        setLoading(false);
        return;
      }

      // 4. Verificación de estado activo (columna 'activo' en tu captura)
      if (data.activo === false) {
        alert("Acceso denegado: Su usuario se encuentra inactivo.");
        setLoading(false);
        return;
      }

      // 5. Almacenamiento de sesión unificado
      const sessionData = {
        id: data.id,
        nombre: data.nombre,
        rol: data.rol.toLowerCase(),
        documento_id: data.documento_id
      };
      
      localStorage.setItem('user_session', JSON.stringify(sessionData));

      // 6. Redirección basada en tu tabla roles_permisos
      const userRol = sessionData.rol;
      if (userRol === 'admin' || userRol === 'administrador') {
        router.push('/admin');
      } else if (userRol === 'supervisor') {
        router.push('/supervisor');
      } else {
        router.push('/empleado');
      }

    } catch (err) {
      alert("Ocurrió un error inesperado durante el inicio de sesión.");
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
              placeholder="Identificación"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400">PIN de Seguridad</label>
            <input 
              type="password" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] text-white outline-none focus:border-blue-500 transition-all text-center text-2xl tracking-[0.2em] font-black"
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

        <div className="mt-10 text-center">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Seguridad Biométrica & GPS Activa</p>
        </div>
      </div>
    </main>
  );
}