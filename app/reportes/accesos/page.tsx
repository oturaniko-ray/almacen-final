'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReporteAccesosPage() {
  const [accesos, setAccesos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    // Traemos las jornadas vinculando el nombre del empleado desde la tabla empleados
    const { data, error } = await supabase
      .from('jornadas')
      .select(`
        id,
        hora_entrada,
        hora_salida,
        estado,
        empleados (
          nombre,
          documento_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setAccesos(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDatos();
  }, [fetchDatos]);

  // Limpieza de Timestamptz para mostrar solo HH:MM:SS
  const limpiarHora = (ts: string | null) => {
    if (!ts) return "--:--:--";
    const d = new Date(ts);
    return d.getUTCHours().toString().padStart(2, '0') + ":" + 
           d.getUTCMinutes().toString().padStart(2, '0') + ":" + 
           d.getUTCSeconds().toString().padStart(2, '0');
  };

  const formatearFecha = (ts: string | null) => {
    if (!ts) return "--/--/--";
    return new Date(ts).toLocaleDateString('es-ES');
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 font-sans flex flex-col">
      
      {/* HEADER UNIFICADO */}
      <div className="max-w-7xl mx-auto w-full mb-8 flex justify-between items-center border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-black italic uppercase">
            HISTORIAL <span className="text-blue-600">ACCESOS</span>
          </h1>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">LOGS DE ENTRADA Y SALIDA</p>
        </div>
        <button 
          onClick={() => router.push('/reportes')}
          className="bg-white/5 hover:bg-white/10 text-white px-10 py-2 rounded-full text-[11px] font-black uppercase italic border border-white/10 transition-all active:scale-95"
        >
          volver atrás
        </button>
      </div>

      {/* TABLA ESTILO MONITOR (SIN RECUADROS PESADOS) */}
      <div className="max-w-7xl mx-auto w-full flex-1 overflow-hidden flex flex-col bg-[#050505] rounded-3xl border border-white/5 shadow-2xl">
        <div className="overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#111] z-10">
              <tr className="text-[10px] font-black uppercase text-white/30 tracking-widest border-b border-white/10">
                <th className="p-5">Empleado</th>
                <th className="p-5 text-center">Fecha</th>
                <th className="p-5 text-center">Entrada</th>
                <th className="p-5 text-center">Salida</th>
                <th className="p-5 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center animate-pulse italic text-white/20">Sincronizando registros...</td>
                </tr>
              ) : accesos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-white/20 uppercase font-black">No se encontraron registros de acceso</td>
                </tr>
              ) : (
                accesos.map((acc) => (
                  <tr key={acc.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                    <td className="p-5">
                      <p className="font-black uppercase italic text-white group-hover:text-blue-500 transition-colors">
                        {acc.empleados?.nombre || 'Desconocido'}
                      </p>
                      <p className="text-[9px] text-white/30 font-mono">{acc.empleados?.documento_id || '---'}</p>
                    </td>
                    <td className="p-5 text-center font-bold text-white/60">
                      {formatearFecha(acc.hora_entrada)}
                    </td>
                    <td className="p-5 text-center">
                      <span className="text-emerald-500 font-black font-mono text-sm">
                        {limpiarHora(acc.hora_entrada)}
                      </span>
                    </td>
                    <td className="p-5 text-center">
                      <span className="text-blue-500 font-black font-mono text-sm">
                        {limpiarHora(acc.hora_salida)}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        acc.estado === 'activo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-white/5 text-white/20'
                      }`}>
                        {acc.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="max-w-7xl mx-auto w-full mt-4">
        <p className="text-[9px] text-white/10 uppercase font-black tracking-[0.5em] text-center">Auditoría de Base de Datos - Acceso Restringido</p>
      </footer>
    </main>
  );
}