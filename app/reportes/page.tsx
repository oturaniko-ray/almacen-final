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
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    
    fetchJornadas();
    
    // AUDITORÍA: Aseguramos que el canal escuche TODOS los eventos (*)
    const channel = supabase
      .channel('cambios_jornadas_realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'jornadas' 
      }, (payload) => {
        console.log("Cambio detectado:", payload);
        fetchJornadas(); // Recarga forzada al detectar cambio
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchJornadas = async () => {
    // No ponemos loading(true) aquí para evitar que la pantalla se ponga en blanco en cada update
    try {
      const { data, error } = await supabase
        .from('jornadas')
        .select('*')
        .order('hora_entrada', { ascending: false });
      
      if (error) throw error;
      setJornadas(data || []);
    } catch (err) {
      console.error("Fuga detectada en fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const calcularTiempoTranscurrido = (entrada: string) => {
    const inicio = new Date(entrada).getTime();
    const ahora = new Date().getTime();
    const dif = Math.floor((ahora - inicio) / 1000);
    const h = Math.floor(dif / 3600).toString().padStart(2, '0');
    const m = Math.floor((dif % 3600) / 60).toString().padStart(2, '0');
    const s = (dif % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // CORRECTIVO: Función de agrupación robusta que no depende del locale del sistema
  const agruparPorFecha = (registros: any[]) => {
    return registros.reduce((groups: any, registro) => {
      const fecha = registro.hora_entrada.split('T')[0]; // Usa formato YYYY-MM-DD directo de la DB
      if (!groups[fecha]) groups[fecha] = [];
      groups[fecha].push(registro);
      return groups;
    }, {});
  };

  const grupos = agruparPorFecha(jornadas);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* MEMBRETE */}
        <div className="flex justify-between items-start mb-10 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-blue-500">
              Reporte de <span className="text-white">Asistencia Crítico</span>
            </h1>
            {user && (
              <div className="mt-2">
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                  {user.nombre} : <span className="text-blue-400 italic">{user.rol} ({user.nivel_acceso})</span>
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={fetchJornadas} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5">Sincronizar</button>
            <button onClick={() => router.back()} className="bg-red-600/20 text-red-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-red-500/20">Cerrar</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500 font-black animate-pulse uppercase">Conectando...</div>
        ) : jornadas.length === 0 ? (
          <div className="text-center py-20 text-slate-600 font-bold uppercase border border-dashed border-white/10 rounded-3xl">
            No se han detectado registros de acceso hoy
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(grupos).map(fecha => (
              <div key={fecha} className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-black italic">{fecha}</span>
                  <div className="h-[1px] flex-1 bg-white/5"></div>
                </div>

                <div className="overflow-hidden rounded-[30px] border border-white/5 bg-[#0f172a] shadow-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/20 text-[10px] font-black text-slate-500 uppercase italic">
                        <th className="p-6">Empleado</th>
                        <th className="p-6">Entrada</th>
                        <th className="p-6">Salida</th>
                        <th className="p-6 text-blue-500">Total (HH:MM:SS)</th>
                        <th className="p-6">Estado</th>
                        <th className="p-6">Autorización</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {grupos[fecha].map((j: any) => (
                        <tr key={j.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="p-6 text-sm font-black text-white uppercase italic group-hover:text-blue-400">
                            {j.nombre_empleado}
                          </td>
                          <td className="p-6 text-[11px] font-mono text-emerald-500/80">
                            {new Date(j.hora_entrada).toLocaleTimeString('es-ES')}
                          </td>
                          <td className="p-6 text-[11px] font-mono text-red-400/80">
                            {j.hora_salida ? new Date(j.hora_salida).toLocaleTimeString('es-ES') : '--:--:--'}
                          </td>
                          <td className="p-6">
                            <span className="text-xl font-black text-blue-400 italic tracking-widest">
                              {j.estado === 'activo' ? calcularTiempoTranscurrido(j.hora_entrada) : (j.horas_trabajadas || '00:00:00')}
                            </span>
                          </td>
                          <td className="p-6">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${
                              j.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/20 text-slate-500'
                            }`}>
                              {j.estado}
                            </span>
                          </td>
                          <td className="p-6 text-[9px] text-slate-500 uppercase italic font-bold">
                            {j.editado_por || 'Registro Base'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}