import { createServerSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';

const DIAS_NOMBRES: Record<number, string> = {
  1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom'
};

async function obtenerTurnos() {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('turnos')
    .select('*')
    .order('hora_inicio');
  
  if (error) {
    console.error('Error obteniendo turnos:', error);
    return [];
  }
  
  return data || [];
}

export default async function TurnosPage() {
  const turnos = await obtenerTurnos();

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

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-7xl mx-auto">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">Turnos</h1>
          <Link
            href="/admin/turnos/nuevo"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            + Nuevo Turno
          </Link>
        </div>

        {turnos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-4">No hay turnos creados</p>
            <Link 
              href="/admin/turnos/nuevo" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Crear el primer turno
            </Link>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid gap-3">
              {turnos.map((turno: any) => (
                <div 
                  key={turno.id} 
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-medium text-gray-800">{turno.nombre}</h2>
                      {turno.descripcion && (
                        <p className="text-sm text-gray-500 mt-1">{turno.descripcion}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      turno.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {turno.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-gray-500">Horario:</span>{' '}
                      <span className="font-medium">{turno.hora_inicio?.slice(0,5)} - {turno.hora_fin?.slice(0,5)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Días:</span>{' '}
                      <span className="font-medium">
                        {turno.dias_semana?.map((d: number) => DIAS_NOMBRES[d]).join(' · ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Capacidad:</span>{' '}
                      <span className="font-medium">{turno.capacidad_min} - {turno.capacidad_max} personas</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}