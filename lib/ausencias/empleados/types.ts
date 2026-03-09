export interface EmpleadoBasico {
  id: string;
  nombre: string;
  documento_id: string;
  email: string;
  nivel_acceso: number;
  rol: string;
  activo: boolean;
  sucursal_origen?: string;
}

export interface BulkEditOperation {
  empleadosIds: string[];
  cambios: {
    nivel_acceso?: number;
    rol?: string;
    activo?: boolean;
    sucursal_origen?: string;
    permiso_reportes?: boolean;
  };
}

export interface BulkEditResult {
  exitosos: number;
  fallidos: number;
  errores: Array<{
    empleado_id: string;
    error: string;
  }>;
}