'use client';

import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAplicar: (cambios: any) => void;
  cantidadSeleccionados: number;
}

export function EditorMasivoModal({ isOpen, onClose, onAplicar, cantidadSeleccionados }: Props) {
  const [cambios, setCambios] = useState({
    nivel_acceso: '',
    rol: '',
    activo: '',
    sucursal_origen: '',
    permiso_reportes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    // Filtrar solo campos con valor
    const cambiosAplicar: any = {};
    
    if (cambios.nivel_acceso) cambiosAplicar.nivel_acceso = parseInt(cambios.nivel_acceso);
    if (cambios.rol) cambiosAplicar.rol = cambios.rol;
    if (cambios.activo !== '') cambiosAplicar.activo = cambios.activo === 'true';
    if (cambios.sucursal_origen) cambiosAplicar.sucursal_origen = cambios.sucursal_origen;
    if (cambios.permiso_reportes !== '') cambiosAplicar.permiso_reportes = cambios.permiso_reportes === 'true';

    onAplicar(cambiosAplicar);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-white font-black text-xl mb-2">EDITAR EMPLEADOS</h2>
        <p className="text-white/60 text-sm mb-4">
          Aplicando cambios a <span className="text-blue-400 font-bold">{cantidadSeleccionados}</span> empleados
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-white/60 text-xs mb-2">NIVEL DE ACCESO</label>
            <select
              value={cambios.nivel_acceso}
              onChange={(e) => setCambios({ ...cambios, nivel_acceso: e.target.value })}
              className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
            >
              <option value="">Sin cambios</option>
              <option value="1">Nivel 1</option>
              <option value="2">Nivel 2</option>
              <option value="3">Nivel 3</option>
              <option value="4">Nivel 4</option>
              <option value="5">Nivel 5</option>
              <option value="6">Nivel 6</option>
              <option value="7">Nivel 7</option>
              <option value="8">Nivel 8</option>
              <option value="9">Nivel 9</option>
              <option value="10">Nivel 10</option>
            </select>
          </div>

          <div>
            <label className="block text-white/60 text-xs mb-2">ROL</label>
            <select
              value={cambios.rol}
              onChange={(e) => setCambios({ ...cambios, rol: e.target.value })}
              className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
            >
              <option value="">Sin cambios</option>
              <option value="empleado">Empleado</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
              <option value="tecnico">Técnico</option>
            </select>
          </div>

          <div>
            <label className="block text-white/60 text-xs mb-2">ESTADO</label>
            <select
              value={cambios.activo}
              onChange={(e) => setCambios({ ...cambios, activo: e.target.value })}
              className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
            >
              <option value="">Sin cambios</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          <div>
            <label className="block text-white/60 text-xs mb-2">SUCURSAL</label>
            <select
              value={cambios.sucursal_origen}
              onChange={(e) => setCambios({ ...cambios, sucursal_origen: e.target.value })}
              className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
            >
              <option value="">Sin cambios</option>
              <option value="01">Sucursal 01</option>
              <option value="02">Sucursal 02</option>
            </select>
          </div>

          <div>
            <label className="block text-white/60 text-xs mb-2">PERMISO REPORTES</label>
            <select
              value={cambios.permiso_reportes}
              onChange={(e) => setCambios({ ...cambios, permiso_reportes: e.target.value })}
              className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
            >
              <option value="">Sin cambios</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 rounded-lg"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
          >
            VISTA PREVIA
          </button>
        </div>
      </div>
    </div>
  );
}