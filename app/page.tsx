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
      // 1. Limpieza absoluta de caracteres no numéricos si es necesario
      const docLimpio = documento.trim();
      const pinLimpio = pin.trim();

      // 2. CONSULTA DINÁMICA
      // Intentamos buscar por coincidencia exacta. Si tu columna es numérica, 
      // Supabase convierte automáticamente el string del .eq() si es posible.
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('documento_id', docLimpio)
        .eq('pin_seguridad', pinLimpio)
        .maybeSingle();

      if (error) {
        console.error("Error de Supabase:", error);
        alert(`Error técnico: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data) {
        // --- BLOQUE DE DIAGNÓSTICO ---
        // Si no hay coincidencia con ID + PIN, buscamos SOLO por ID para saber qué falla
        const { data: checkId, error: checkError } = await supabase
          .from('empleados')
          .select('nombre, documento_id')
          .eq('documento_id', docLimpio)
          .maybeSingle();

        if (checkError) {
          console.error("Error en diagnóstico:", checkError);
        }

        if (checkId) {
          alert(`Usuario "${checkId.nombre}" localizado, pero el PIN es incorrecto.`);
        } else {
          alert(`El ID "${docLimpio}" no existe en la tabla "empleados". Verifique si hay espacios o si el ID es correcto en la base de datos.`);
        }
        setLoading(false);
        return;
      }

      // 3. VERIFICACIÓN DE ESTADO
      if (!data.activo) {
        alert("Usuario inactivo en el sistema.");
        setLoading(false);
        return;
      }

      // 4. PERSISTENCIA DE SESIÓN
      localStorage.setItem('user_session', JSON.stringify({
        id: data.id,
        nombre: data.nombre,
        rol: data.rol?.toLowerCase().trim() || 'empleado',
        documento_id: data.documento_id
      }));

      // 5. REDIRECCIÓN BASADA EN ROL
      const rol = data.rol?.toLowerCase().trim();
      if (rol === 'admin' || rol === 'administrador') {
        router.push('/admin');
      } else if (rol === 'supervisor') {
        router.push('/supervisor');
      } else {
        router.push('/empleado');
      }

    } catch (err) {
      alert("Error crítico de red.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 font-sans text-white">
      <div className="w-full max-w-sm bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl relative overflow-hidden">
        {/* Decoración estética */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
        
        <div className="text-center mb-10 relative">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">
            SISTEMA <span className="text-blue-500">PRO</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Gestión de Acceso</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400">Identificación</label>
            <input 
              type="text" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all font-bold text-lg"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="Ej: 102030"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase ml-4 text-slate-400">PIN Privado</label>
            <input 
              type="password" 
              className="w-full bg-[#050a14] border border-white/5 p-5 rounded-[25px] outline-none focus:border-blue-500 transition-all text-center text-3xl tracking-[0.3em] font-black"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="****"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-[25px] font-black uppercase italic tracking-widest mt-6 transition-all shadow-xl shadow-blue-900/10 disabled:opacity-50"
          >
            {loading ? 'Sincronizando...' : 'Entrar al Sistema'}
          </button>
        </form>

        <div className="mt-10 text-center relative">
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest leading-loose">
            Validación de Seguridad Cifrada<br/>GPS & Biometría Activa
          </p>
        </div>
      </div>
    </main>
  );
}