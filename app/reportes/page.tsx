'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [user, setUser] = useState<any>(null);
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restauración del Membrete (Datos de Sesión)
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      setUser(JSON.parse(sessionData));
    }

    fetchJornadas();
    
    const channel = supabase
      .channel('cambios_jornadas_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => {
        fetchJornadas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchJornadas = async () => {
    setLoading(true);
    try {
      /**
       * Intentamos ordenar por updated_at para captar la última salida.
       * Si da error o no hay datos, es posible que la columna no exista o esté vacía.
       */
      const { data, error } = await supabase
        .from('jornadas')
        .select('*')
        .order('hora_entrada', { ascending: false }); // Usamos hora_entrada como base segura para que siempre muestre datos
      
      if (error) throw error;
      
      // Si quieres que el que acaba de marcar salida suba arriba, 
      // ordenamos el array localmente por la fecha más reciente entre entrada y salida
      const datosOrdenados = (data || []).sort((a: any, b: any) => {
        const fechaA = new Date(a.hora_salida || a.hora_entrada).getTime();
        const fechaB = new Date(b.hora_salida || b.hora_entrada).getTime();
        return fechaB - fechaA;
      });

      setJornadas(datosOrdenados);
    } catch (err) {
      console.error("Error cargando jornadas:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* MEMBRETE RESTAURADO */}
        <div className="flex justify-between items-start mb-10 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter">
              Reporte de <span className="text-blue-500">Asistencia Crítico</span>
            </h1>
            {user && (
              <div className="mt-2">
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                  USUARIO: {user.nombre} | ROL: <span className="text-blue-400 italic">{user.rol} ({user.nivel_acceso || 'N/A'})</span>
                </p>
                <p className="text-[9px] font-black text-slate-500 uppercase mt-1 italic tracking-widest">
                  ● SISTEMA OPERATIVO EN TIEMPO REAL
                </p>
              </div>
            )}
          </div>
          
          <div className="flex gap-4">
            <button onClick={fetchJornadas} className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5 transition-all">Refrescar</button>
            <button onClick={() => router.back()} className="bg-red-600/20 text-red-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-red-500/20">Cerrar</button>
          </div>
        </div>

        {loading && jornadas.length === 0 ? (
          <div className="text-center py-20 text-slate-500 font-black animate-pulse uppercase tracking-widest italic">
            Buscando registros en la base de datos...
          </div>
        ) : jornadas.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-[40px]">
            <p className="text-slate-600 font-black uppercase italic text-sm">No hay actividad registrada el día de hoy</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[35px] border border-white/5 bg-[#0f172a] shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20">
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Empleado</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Entrada</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Salida</th>
                  <th className="p-6 text-[10px] font-black text-blue-500 uppercase italic">Total Horas (H:M:S)</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase italic">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jornadas.map((j) => (
                  <tr key={j.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-6">
                      <p className="text-sm font-black text-white uppercase italic group-hover:text-blue-400 transition-colors">
                        {j.nombre_empleado}
                      </p>
                      <p className="text-[8px] text-slate-600 font-bold uppercase italic">
                        AUT: {j.editado_por || 'SISTEMA'}
                      </p>
                    </td>
                    <td className="p-6 text-[11px] font-mono text-emerald-500/80">
                      {new Date(j.hora_entrada).toLocaleString('es-ES', { 
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                      })}
                    </td>
                    <td className="p-6 text-[11px] font-mono text-red-400/80">
                      {j.hora_salida ? (
                        new Date(j.hora_salida).toLocaleString('es-ES', { 
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                        })
                      ) : '--:--:--'}
                    </td>
                    <td className="p-6">
                      <span className="text-xl font-black text-blue-400 italic tracking-tighter">
                        {j.horas_trabajadas || '00:00:00'}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${
                        j.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/20 text-slate-500'
                      }`}>
                        {j.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}