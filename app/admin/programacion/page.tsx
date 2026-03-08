import { createServerSupabaseClient } from '@/lib/supabase/client';
import { obtenerAsignaciones } from '@/lib/turnos/service';
import { ProgramacionClient } from './components/ProgramacionClient';
import Link from 'next/link';

async function obtenerEmpleados() {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('empleados')
    .select('id, nombre')
    .order('nombre');
  
  if (error) {
    console.error('Error obteniendo empleados:', error);
    return [];
  }
  
  return data || [];
}

export default async function ProgramacionPage({
  searchParams
}: {
  searchParams: { semana?: string }
}) {
  const empleados = await obtenerEmpleados();
  
  let fechaBase = new Date();
  if (searchParams.semana) {
    fechaBase = new Date(searchParams.semana);
  }
  
  const inicioSemana = new Date(fechaBase);
  const diaSemana = fechaBase.getDay();
  const diff = diaSemana === 0 ? 6 : diaSemana - 1;
  inicioSemana.setDate(fechaBase.getDate() - diff);
  
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);
  
  const fechaInicioStr = inicioSemana.toISOString().split('T')[0];
  const fechaFinStr = finSemana.toISOString().split('T')[0];
  
  const asignacionesResult = await obtenerAsignaciones({
    fecha_inicio: fechaInicioStr,
    fecha_fin: fechaFinStr
  });
  
  const asignaciones = asignacionesResult.success ? asignacionesResult.data || [] : [];
  
  return (
    <div className="pt-20 p-6 w-full">
      {/* Botón VOLVER */}
      <div className="max-w-7xl mx-auto mb-4">
        <Link
          href="/admin/rrhh-operativo/gestion-horarios"
          className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2 hover:text-blue-400 transition-colors"
        >
          <span className="text-lg">←</span> VOLVER
        </Link>
      </div>

      <ProgramacionClient 
        empleados={empleados}
        asignacionesIniciales={asignaciones}
        fechaBaseInicial={fechaBase}
      />
    </div>
  );
}