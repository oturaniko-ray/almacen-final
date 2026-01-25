'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [user, setUser] = useState<any>(null);
  const [reportes, setReportes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState(''); 
  const [fechaFin, setFechaFin] = useState('');    
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador', 'supervisor'].includes(currentUser.rol)) { router.replace('/'); return; }
    setUser(currentUser);
    
    consultarReportes();
  }, [router]);

  const consultarReportes = async () => {
    setLoading(true);
    let query = supabase.from('jornadas_completas').select('*').order('hora_entrada', { ascending: false });
    
    if (filtroNombre) query = query.ilike('nombre_empleado', `%${filtroNombre}%`);
    if (fechaInicio) query = query.gte('hora_entrada', `${fechaInicio}T00:00:00`);
    if (fechaFin) query = query.lte('hora_entrada', `${fechaFin}T23:59:59`);

    const { data } = await query;
    if (data) setReportes(data);
    setLoading(false);
  };

  const exportarExcel = () => {
    if (reportes.length === 0) return;

    const ahora = new Date();
    const timestamp = ahora.toISOString().replace(/[-T:Z]/g, '').slice(0, 12);
    const nombreArchivo = `operaciones${timestamp}.xlsx`;

    // MODIFICACIÓN 4: Encabezado con nombre y rol de quien exporta, más fecha/hora y separadores de fecha
    const rows = [
      ["REPORTE GENERADO POR:", `${user?.nombre || 'N/A'} (${user?.rol || 'N/A'})`],
      ["FECHA Y HORA DE EXPORTACIÓN:", ahora.toLocaleString()],
      [],
      ["FECHA/HORA", "NOMBRE EMPLEADO", "ENTRADA", "SALIDA", "HORAS TOTALES"]
    ];

    let fechaActualExcel = "";
    reportes.forEach(r => {
      const fechaFila = new Date(r.hora_entrada).toLocaleDateString();
      if (fechaFila !== fechaActualExcel) {
        fechaActualExcel = fechaFila;
        // MODIFICACIÓN 4: Inserción de separador de fecha en el cuerpo del Excel
        rows.push([`--- DÍA: ${fechaActualExcel} ---`]);
      }
      rows.push([
        "",
        r.nombre_empleado,
        new Date(r.hora_entrada).toLocaleString(),
        r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'EN CURSO',
        r.horas_trabajadas?.toFixed(2) || "0.00"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, nombreArchivo);
  };

  let fechaCabeceraActual = "";

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          {/* MODIFICACIÓN 1: Color de "Operaciones" cambiado a azul (text-blue-500) para coincidir con el menú principal */}
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">Reportes de <span className="text-blue-500">Operaciones</span></h1>
          <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700">← Volver</button>
        </header>

        <div className="bg-[#0f172a] p-8 rounded-[45px] border border-white/5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-4">Nombre Empleado</label>
              <input className="w-full bg-[#050a14] p-4 rounded-2xl border border-white/10 text-xs" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} placeholder="Ej: Juan Perez" />
            </div>
            
            {/* MODIFICACIÓN 3: Inputs cambiados a type="date" para mostrar calendario de selección nativo (Desde / Hasta) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-4">Desde</label>
              <input type="date" className="w-full bg-[#050a14] p-4 rounded-2xl border border-white/10 text-xs text-white" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-4">Hasta</label>
              <input type="date" className="w-full bg-[#050a14] p-4 rounded-2xl border border-white/10 text-xs text-white" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <button onClick={consultarReportes} className="flex-1 bg-blue-600 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500">Filtrar</button>
              <button onClick={exportarExcel} className="bg-emerald-600 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500">Exportar</button>
            </div>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[45px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="p-6">Empleado</th>
                <th className="p-6">Entrada</th>
                <th className="p-6">Salida</th>
                <th className="p-6">Total Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {reportes.map((r, i) => {
                const fechaFila = new Date(r.hora_entrada).toLocaleDateString();
                const mostrarSeparador = fechaFila !== fechaCabeceraActual;
                if (mostrarSeparador) fechaCabeceraActual = fechaFila;

                return (
                  <React.Fragment key={i}>
                    {/* MODIFICACIÓN 2: Inserción de fila separadora de fecha en los registros de acceso visuales */}
                    {mostrarSeparador && (
                      <tr className="bg-blue-500/5">
                        <td colSpan={4} className="p-3 text-center text-[10px] font-black text-blue-400 uppercase tracking-[0.5em] border-y border-blue-500/10">
                          --- {fechaFila} ---
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-white/[0.01] transition-colors group">
                      <td className="p-6 font-bold group-hover:text-blue-500 transition-colors uppercase text-sm">{r.nombre_empleado}</td>
                      <td className="p-6 text-xs text-slate-400 font-mono">{new Date(r.hora_entrada).toLocaleString()}</td>
                      <td className="p-6 text-xs text-slate-400 font-mono">{r.hora_salida ? new Date(r.hora_salida).toLocaleString() : <span className="text-blue-500 italic uppercase">En Curso</span>}</td>
                      <td className="p-6">
                        <span className="bg-blue-600/10 text-blue-400 px-4 py-1 rounded-full font-black text-xs">
                          {r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '0.00'} H
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}