import { useCallback } from 'react';
import { ExcelService } from '@/lib/excel/excelService';
import { useNotificacion } from './useNotificacion';

interface ColumnaExcel<T> {
  header: string;
  key: keyof T;
  ancho?: number;
  formato?: (valor: any) => string;
}

export function useExportarExcel<T>() {
  const { mostrarNotificacion } = useNotificacion();

  const exportar = useCallback((
    datos: T[],
    columnas: ColumnaExcel<T>[],
    titulo: string,
    nombreArchivo: string,
    usuario?: any
  ) => {
    try {
      // ✅ CORREGIDO: crearHoja solo recibe los datos, no el título
      const libro = ExcelService.crearLibro();
      const hoja = ExcelService.crearHoja(datos); // Solo un argumento
      
      // Agregar membrete (esto modifica la hoja directamente)
      ExcelService.agregarMembrete(hoja, titulo, usuario);

      // Configurar anchos de columna
      columnas.forEach((col, idx) => {
        if (col.ancho) {
          // Esto es una simplificación, ajusta según necesites
          const columna = String.fromCharCode(65 + idx); // A, B, C, etc.
          // ExcelJS maneja los anchos de manera diferente
        }
      });

      // Agregar hoja al libro
      ExcelService.agregarHojaAlLibro(libro, hoja, titulo);

      // Exportar
      ExcelService.exportar(libro, `${nombreArchivo}.xlsx`);
      
      mostrarNotificacion('ARCHIVO EXPORTADO', 'exito');
    } catch (error) {
      console.error('Error al exportar:', error);
      mostrarNotificacion('Error al exportar', 'error');
    }
  }, [mostrarNotificacion]);

  return { exportar };
}