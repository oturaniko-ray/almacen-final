// lib/types/entities.ts
export interface Empleado {
  id: string;
  nombre: string;
  documento_id: string;
  email: string;
  telefono: string | null;
  rol: 'admin' | 'supervisor' | 'tecnico' | 'empleado';
  nivel_acceso: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  activo: boolean;
  permiso_reportes: boolean;
  pin_seguridad: string;
  pin_generado_en: string;
  sucursal_origen: string;
  en_almacen?: boolean;
  created_at?: string;
}

export interface TelegramUsuario {
  id: string;
  empleado_id: string;
  chat_id: string;
  username?: string;
  activo: boolean;
  created_at: string;
}