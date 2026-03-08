import Link from 'next/link';

export default function ReportesPage() {
  const modulos = [
    {
      titulo: 'Timesheet Semanal',
      descripcion: 'Horas trabajadas por empleado',
      href: '/admin/reportes/timesheet',
      icono: '📊'
    },
    {
      titulo: 'Turnos Planificados vs Reales',
      descripcion: 'Comparativa de asistencia',
      href: '/admin/reportes/comparativa',
      icono: '📈'
    },
    {
      titulo: 'Estadísticas de Ausencias',
      descripcion: 'Análisis de ausencias por tipo',
      href: '/admin/reportes/ausencias',
      icono: '📉'
    }
  ];

  return (
    <div className="pt-20 p-6 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Reportes</h1>
        <p className="text-sm text-gray-500">Selecciona un tipo de reporte</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map((modulo) => (
          <Link
            key={modulo.href}
            href={modulo.href}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-3">{modulo.icono}</div>
            <h2 className="text-lg font-medium text-gray-800 mb-2">{modulo.titulo}</h2>
            <p className="text-sm text-gray-500">{modulo.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}