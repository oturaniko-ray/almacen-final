'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ProgramadorModal } from './components/ProgramadorModal';
import { ListaReportes } from './components/ListaReportes';
import { createBrowserSupabaseClient } from '@/lib/supabase/client-browser';
import type { ReporteProgramado } from '@/lib/reportes/types';

export default function ReportesProgramadosPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [reportes, setReportes] = useState<ReporteProgramado[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReporte, setEditingReporte] = useState<ReporteProgramado | null>(null);
  const supabase = createBrowserSupabaseClient();

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
    cargarReportes();
  }, []);

  const cargarReportes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reportes_programados')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setReportes(data as ReporteProgramado[]);
    }
    setLoading(false);
  };

  const handleCrear = () => {
    setEditingReporte(null);
    setModalOpen(true);
  };

  const handleEditar = (reporte: ReporteProgramado) => {
    setEditingReporte(reporte);
    setModalOpen(true);
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este reporte programado?')) return;
    
    const { error } = await supabase
      .from('reportes_programados')
      .delete()
      .eq('id', id);
    
    if (!error) {
      cargarReportes();
    }
  };

  const handleToggleActivo = async (reporte: ReporteProgramado) => {
    const { error } = await supabase
      .from('reportes_programados')
      .update({ activo: !reporte.activo })
      .eq('id', reporte.id);
    
    if (!error) {
      cargarReportes();
    }
  };

  return (
    <main className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">REPORTES PROGRAMADOS</h1>
            <p className="text-white/40 text-sm">
              Configura envíos automáticos de reportes por email
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCrear}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold"
            >
              + NUEVO REPORTE
            </button>
            <Link
              href="/admin/reportes"
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold"
            >
              VOLVER
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-white/40">Cargando...</div>
        ) : reportes.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-12 text-center">
            <p className="text-white/40 mb-4">No hay reportes programados</p>
            <button
              onClick={handleCrear}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold"
            >
              CREAR PRIMER REPORTE
            </button>
          </div>
        ) : (
          <ListaReportes
            reportes={reportes}
            onEditar={handleEditar}
            onEliminar={handleEliminar}
            onToggleActivo={handleToggleActivo}
          />
        )}
      </div>

      {/* Modal de creación/edición */}
      <ProgramadorModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingReporte(null);
        }}
        reporte={editingReporte}
        onGuardado={cargarReportes}
        usuarioId={user?.id}
      />
    </main>
  );
}