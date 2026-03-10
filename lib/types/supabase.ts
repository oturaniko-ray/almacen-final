export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      empleados: {
        Row: {
          id: string
          nombre: string
          documento_id: string
          email: string
          telefono: string | null
          rol: 'admin' | 'supervisor' | 'tecnico' | 'empleado'
          nivel_acceso: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
          activo: boolean
          permiso_reportes: boolean
          pin_seguridad: string
          pin_generado_en: string
          sucursal_origen: string
          en_almacen: boolean | null
          created_at: string
        }
        Insert: {
          id?: never
          nombre: string
          documento_id: string
          email: string
          telefono: string | null
          rol: 'admin' | 'supervisor' | 'tecnico' | 'empleado'
          nivel_acceso: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
          activo: boolean
          permiso_reportes: boolean
          pin_seguridad: string
          pin_generado_en: string
          sucursal_origen: string
          en_almacen?: boolean | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['empleados']['Insert']>
      }
      telegram_usuarios: {
        Row: {
          id: string
          empleado_id: string
          chat_id: string
          username: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: never
          empleado_id: string
          chat_id: string
          username?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['telegram_usuarios']['Insert']>
      }
    }
    Functions: {
      generar_pin_empleado: {
        Args: { p_sucursal_codigo: string }
        Returns: string
      }
    }
  }
}