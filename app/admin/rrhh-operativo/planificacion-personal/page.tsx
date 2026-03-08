'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PlanificacionPersonalPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 7) {
      router.replace('/admin');
      return;
    }
    setUser(currentUser);
    setLoading(false);
  }, [router]);

  const volverAGestion = () => {
    router.push('/admin/rrhh-operativo/planificacion');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </main>
    );
  }

  const Memebrete = () => (
    <div className="w-full max-w-sm bg-[#1a1a1a] px-5 py-3 rounded-[18px] border border-white/5 mb-3 text-center shadow-xl">
      <h1 className="text-base font-black italic uppercase tracking-tighter leading-none mb-1">
        <span className="text-white">PLANIFICACIÓN DE </span>
        <span className="text-green-400">PERSONAL</span>
      </h1>
      <div className="flex items-center justify-center gap-2 pt-1 border-t border-white/10 mt-1">
        <span className="text-xs text-white normal-case">{user.nombre}</span>
        <span className="text-xs text-white/40">•</span>
        <span className="text-xs text-green-400 normal-case">{user.rol || 'Administrador'}</span>
      </div>
    </div>
  );

  const BotonOpcion = ({
    texto,
    descripcion,
    onClick,
    color,
  }: {
    texto: string;
    descripcion: string;
    onClick: () => void;
    color: string;
  }) => (
    <button
      onClick={onClick}
      className={`w-full ${color} px-4 py-5 rounded-xl border border-white/10
        active:scale-95 transition-transform shadow-md
        flex flex-col items-center justify-center gap-1 text-center`}
    >
      <span className="text-white font-black uppercase text-[13px] tracking-wider leading-tight">
        {texto}
      </span>
      <span className="text-white/55 text-[10px] uppercase font-semibold tracking-widest leading-relaxed">
        {descripcion}
      </span>
    </button>
  );

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-start pt-10 px-4 pb-4 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Memebrete />

        <div className="w-full space-y-4">
          
          <BotonOpcion
            texto="SOLICITUDES DE AUSENCIA"
            descripcion="GESTIÓN DE VACACIONES, PERMISOS Y LICENCIAS. APROBACIONES"
            onClick={() => router.push('/admin/ausencias/solicitudes')}
            color="bg-green-600"
          />
          
          <BotonOpcion
            texto="CALENDARIO DE AUSENCIAS"
            descripcion="VISUALIZACIÓN DE AUSENCIAS POR EMPLEADO Y PERÍODO"
            onClick={() => router.push('/admin/ausencias/calendario')}
            color="bg-teal-600"
          />

        </div>

        <div className="w-full max-w-sm mt-8 pt-4 border-t border-white/5 text-center">
          <button
            onClick={volverAGestion}
            className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto hover:text-blue-400 transition-colors"
          >
            <span className="text-lg">←</span> VOLVER A GESTIÓN Y PLANIFICACIÓN
          </button>
        </div>
      </div>
    </main>
  );
}