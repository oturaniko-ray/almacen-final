export type Empleado = {
  id: string;
  nombre: string;
  documento_id: string;
  email: string;
  telefono: string | null;
  rol: 'admin' | 'supervisor' | 'tecnico' | 'empleado';
  nivel_acceso: number;
  activo: boolean;
  permiso_reportes: boolean;
  pin_seguridad: string;
  pin_generado_en: string;
  sucursal_origen: string;
  en_almacen?: boolean;
  created_at?: string;
};

export type EmpleadoInsert = Omit<Empleado, 'id' | 'created_at'>;
export type EmpleadoUpdate = Partial<Omit<Empleado, 'id' | 'created_at'>>;