'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReporteAccesosPage() {
  const [accesos, setAccesos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  const fetchAccesos = useCallback(async () => {
    setLoading(true);
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));

    // Consulta unificada a la tabla jornadas con información del empleado
    const { data, error } = await supabase
      .from('jornadas')
      .select(`
        *,
        empleados (nombre, documento_id)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setAccesos(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccesos();
  }, [fetchAccesos]);

  // Función de limpieza para Timestamptz (Extrae Fecha y Hora por separado)
  const formatearFechaHora = (timestamp: string | null) => {
    if (!timestamp) return { fecha: '--/--/--', hora: '--:--:--' };
    const d = new Date(timestamp);
    return {
      fecha: d.toLocaleDateString('es-ES'),
      hora: d.getUTCHours().toString().padStart(2, '0') + ":" + 
            d.getUTCMinutes().toString().padStart(2, '0') + ":" + 
            d.getUTCSeconds().toString().padStart(2, '0')
    };
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 font-sans">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8 flex justify-between items-center border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-black italic uppercase italic">
            HISTORIAL DE <span className="text-blue-600">ACCESOS</span>
          </h1>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
            Auditoría de Jornadas Laborales
          </p>
        </div>
        <button 
          onClick={() => router.push('/reportes')}
          className="bg-white/5 hover:bg-white/10 text-white px-8 py-2 rounded-full text-[10px] font-black uppercase italic border border-white/10 transition-all"
        >
          volver atrás
        </button>
      </div>

      {/* TABLA DE ACCESOS */}
      <div className="max-w-6xl mx-auto bg-[#0a0a0a] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#111] text-[10px] font-black uppercase text-white/40 tracking-widest">
              <th className="p-4 border-b border-white/5">Empleado</th>
              <th className="p-4 border-b border-white/5">Documento</th>
              <th className="p-4 border-b border-white/5">Fecha</th>
              <th className="p-4 border-b border-white/5">Entrada</th>
              <th className="p-4 border-b border-white/5">Salida</th>
              <th className="p-4 border-b border-white/5">Estado</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {loading ? (
              <tr><td colSpan={6} className="p-10 text-center animate-pulse italic">Cargando base de datos...</td></tr>
            ) : accesos.map((acc) => {
              const entrada = formatearFechaHora(acc.hora_entrada);
              const salida = formatearFechaHora(acc.hora_salida);
              return (
                <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-bold uppercase italic">{acc.empleados?.nombre || 'N/A'}</td>
                  <td className="p-4 font-mono text-white/60">{acc.empleados?.documento_id || '---'}</td>
                  <td className="p-4">{entrada.fecha}</td>
                  <td className="p-4 text-emerald-500 font-bold">{entrada.hora}</td>
                  <td className="p-4 text-blue-500 font-bold">{salida.hora}</td>
                  <td className="p-4 text-[9px] font-black uppercase">
                    <span className={acc.estado === 'activo' ? 'text-emerald-500' : 'text-white/20'}>
                      {acc.estado}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}