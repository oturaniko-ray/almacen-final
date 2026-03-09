'use client';

import type { EmpleadoBasico } from '@/lib/empleados/types';  // ← CORREGIDO: @/lib en lugar de @lib

interface Props {
  empleados: EmpleadoBasico[];
  seleccionados: string[];
  onSeleccionar: (ids: string[]) => void;
  onSeleccionarTodos: () => void;
  filtros: any;
  onFiltrosChange: (filtros: any) => void;
  loading: boolean;
}

export function SelectorEmpleados({
  empleados,
  seleccionados,
  onSeleccionar,
  onSeleccionarTodos,
  filtros,
  onFiltrosChange,
  loading
}: Props) {
  const toggleEmpleado = (id: string) => {
    if (seleccionados.includes(id)) {
      onSeleccionar(seleccionados.filter(s => s !== id));
    } else {
      onSeleccionar([...seleccionados, id]);
    }
  };

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-white/10 overflow-hidden">
      {/* Filtros */}
      <div className="p-4 border-b border-white/10 grid grid-cols-3 gap-4">
        <select
          value={filtros.sucursal}
          onChange={(e) => onFiltrosChange({ ...filtros, sucursal: e.target.value })}
          className="bg-[#0f172a] border border-white/10 rounded-lg p-2 text-white text-sm"
        >
          <option value="">Todas las sucursales</option>
          <option value="01">Sucursal 01</option>
          <option value="02">Sucursal 02</option>
        </select>

        <select
          value={filtros.rol}
          onChange={(e) => onFiltrosChange({ ...filtros, rol: e.target.value })}
          className="bg-[#0f172a] border border-white/10 rounded-lg p-2 text-white text-sm"
        >
          <option value="">Todos los roles</option>
          <option value="empleado">Empleado</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Administrador</option>
          <option value="tecnico">Técnico</option>
        </select>

        <select
          value={filtros.activo.toString()}
          onChange={(e) => onFiltrosChange({ ...filtros, activo: e.target.value === 'true' })}
          className="bg-[#0f172a] border border-white/10 rounded-lg p-2 text-white text-sm"
        >
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Cabecera de tabla */}
      <div className="px-4 py-2 bg-[#0f172a] border-b border-white/10 flex items-center">
        <div className="w-8">
          <input
            type="checkbox"
            checked={seleccionados.length === empleados.length && empleados.length > 0}
            onChange={onSeleccionarTodos}
            className="rounded border-gray-300"
          />
        </div>
        <div className="flex-1 grid grid-cols-6 gap-2 text-xs font-bold text-white/60">
          <span className="col-span-2">NOMBRE</span>
          <span>DOCUMENTO</span>
          <span>EMAIL</span>
          <span>ROL</span>
          <span>NIVEL</span>
        </div>
      </div>

      {/* Lista de empleados */}
      {loading ? (
        <div className="p-8 text-center text-white/40">Cargando empleados...</div>
      ) : empleados.length === 0 ? (
        <div className="p-8 text-center text-white/40">
          No hay empleados que coincidan con los filtros
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {empleados.map((emp) => (
            <div
              key={emp.id}
              className="px-4 py-3 border-b border-white/5 hover:bg-white/5 flex items-center"
            >
              <div className="w-8">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(emp.id)}
                  onChange={() => toggleEmpleado(emp.id)}
                  className="rounded border-gray-300"
                />
              </div>
              <div className="flex-1 grid grid-cols-6 gap-2 text-sm items-center">
                <span className="col-span-2 text-white font-medium truncate">
                  {emp.nombre}
                </span>
                <span className="text-white/60 text-xs">{emp.documento_id}</span>
                <span className="text-white/60 text-xs truncate">{emp.email}</span>
                <span className="text-blue-400 text-xs uppercase">{emp.rol}</span>
                <span className="text-white text-xs">{emp.nivel_acceso}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}