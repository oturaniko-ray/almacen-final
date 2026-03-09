'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { obtenerEmpleadosParaSeleccion, actualizarEmpleadosMasivo } from '@/lib/empleados/bulk-actions';
import { SelectorEmpleados } from './components/SelectorEmpleados';
import { EditorMasivoModal } from './components/EditorMasivoModal';
import { VistaPreviaCambios } from './components/VistaPreviaCambios';
import type { EmpleadoBasico, BulkEditOperation } from '@/lib/empleados/types';

export default function EdicionMasivaPage() {
  const router = useRouter();
  const [empleados, setEmpleados] = useState<EmpleadoBasico[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cambiosPendientes, setCambiosPendientes] = useState<any>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [filtros, setFiltros] = useState({
    sucursal: '',
    rol: '',
    activo: true
  });

  useEffect(() => {
    cargarEmpleados();
  }, [filtros]);

  const cargarEmpleados = async () => {
    setLoading(true);
    try {
      const data = await obtenerEmpleadosParaSeleccion(filtros);
      setEmpleados(data);
    } catch (error) {
      console.error('Error cargando empleados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeleccionarTodos = () => {
    if (seleccionados.length === empleados.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(empleados.map(e => e.id));
    }
  };

  const handleAplicarCambios = async (cambios: any) => {
    setCambiosPendientes(cambios);
    setPreviewOpen(true);
  };

  const handleConfirmar = async () => {
    setPreviewOpen(false);
    setModalOpen(false);
    setLoading(true);

    try {
      const operacion: BulkEditOperation = {
        empleadosIds: seleccionados,
        cambios: cambiosPendientes
      };

      const res = await actualizarEmpleadosMasivo(operacion);
      setResultado(res);
      
      // Recargar empleados
      await cargarEmpleados();
      setSeleccionados([]);
      setCambiosPendientes(null);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">EDICIÓN MASIVA DE EMPLEADOS</h1>
            <p className="text-white/40 text-sm">
              Selecciona múltiples empleados y aplica cambios en lote
            </p>
          </div>
          <Link
            href="/admin/empleados"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold"
          >
            ← VOLVER
          </Link>
        </div>

        {/* Resultado de operación */}
        {resultado && (
          <div className={`mb-4 p-4 rounded-xl ${
            resultado.fallidos === 0 
              ? 'bg-green-600/20 border border-green-600/30' 
              : 'bg-yellow-600/20 border border-yellow-600/30'
          }`}>
            <p className="text-white font-bold">
              ✅ {resultado.exitosos} empleados actualizados correctamente
            </p>
            {resultado.fallidos > 0 && (
              <p className="text-yellow-400 text-sm mt-1">
                ⚠️ {resultado.fallidos} empleados con errores
              </p>
            )}
          </div>
        )}

        {/* Selector de empleados */}
        <SelectorEmpleados
          empleados={empleados}
          seleccionados={seleccionados}
          onSeleccionar={setSeleccionados}
          onSeleccionarTodos={handleSeleccionarTodos}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          loading={loading}
        />

        {/* Barra de acciones */}
        {seleccionados.length > 0 && (
          <div className="mt-4 p-4 bg-[#1a1a1a] rounded-xl border border-white/10 flex items-center justify-between">
            <span className="text-white">
              <span className="font-bold text-blue-400">{seleccionados.length}</span> empleados seleccionados
            </span>
            <button
              onClick={() => setModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold"
            >
              APLICAR CAMBIOS MASIVOS
            </button>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      <EditorMasivoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAplicar={handleAplicarCambios}
        cantidadSeleccionados={seleccionados.length}
      />

      {/* Vista previa de cambios */}
      <VistaPreviaCambios
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirmar={handleConfirmar}
        cambios={cambiosPendientes}
        cantidad={seleccionados.length}
      />
    </main>
  );
}