'use client';

interface Props {
  resumen: {
    total_turnos: number;
    turnos_cumplidos: number;
    turnos_no_cumplidos: number;
    porcentaje_cumplimiento: number;
    empleados_con_ausencias: Array<{
      empleado_nombre: string;
      ausencias: number;
    }>;
  };
}

export function ResumenCumplimiento({ resumen }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      {/* Tarjeta: Total Turnos */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 uppercase">Total Turnos</p>
        <p className="text-2xl font-semibold text-gray-800">{resumen.total_turnos}</p>
      </div>

      {/* Tarjeta: Turnos Cumplidos */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 uppercase">Cumplidos</p>
        <p className="text-2xl font-semibold text-green-600">{resumen.turnos_cumplidos}</p>
      </div>

      {/* Tarjeta: Turnos No Cumplidos */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 uppercase">No Cumplidos</p>
        <p className="text-2xl font-semibold text-red-600">{resumen.turnos_no_cumplidos}</p>
      </div>

      {/* Tarjeta: % Cumplimiento */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-500 uppercase">Cumplimiento</p>
        <p className="text-2xl font-semibold text-blue-600">{resumen.porcentaje_cumplimiento}%</p>
      </div>

      {/* Top 3 empleados con más ausencias */}
      {resumen.empleados_con_ausencias.length > 0 && (
        <div className="md:col-span-4 bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Empleados con más ausencias</p>
          <div className="space-y-1">
            {resumen.empleados_con_ausencias.slice(0, 3).map((emp, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-600">{emp.empleado_nombre}</span>
                <span className="font-medium text-red-600">{emp.ausencias} ausencias</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}