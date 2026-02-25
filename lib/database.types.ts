export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

type EmpleadoRow = {
    id: string
    nombre: string
    documento_id: string
    email: string | null
    telefono: string | null
    rol: string
    activo: boolean
    permiso_reportes: boolean
    nivel_acceso: number
    pin_seguridad: string | null
    pin_generado_en: string | null
    provincia_id: string | null
    respondio_contact_id: string | null
    respondio_sincronizado: boolean | null
    respondio_ultima_sincronizacion: string | null
    en_almacen: boolean | null
    ultimo_ingreso: string | null
    ultima_salida: string | null
}

type FlotaPerfilRow = {
    id: string
    nombre_completo: string
    documento_id: string
    email: string | null
    telefono: string | null
    nombre_flota: string | null
    cant_choferes: number
    cant_rutas: number
    pin_secreto: string
    activo: boolean
    fecha_creacion: string
}

type ProgramacionesRow = {
    id: string
    tipo: string
    titulo: string
    descripcion: string | null
    fecha_programada: string
    fecha_fin: string | null
    destinatarios: Json
    mensaje_template: string
    estado: string
    creado_por: string | null
}

type WhatsappMensajesRow = {
    id: string
    message_id: string
    wa_id: string
    recipient_id: string
    display_phone_number: string
    message_type: string | null
    message_body: string | null
    template_name: string | null
    status: string
    status_timestamp: string
    empleado_id: string | null
    provincia_id: string | null
    raw_payload: Json | null
    pricing_category: string | null
    billable: boolean | null
}

type TelegramUsuariosRow = {
    id: string
    chat_id: string
    empleado_id: string
}

type SistemaConfigRow = {
    id: string
    clave: string
    valor: Json | null
    updated_at: string | null
}

type JornadasRow = {
    id: string
    empleado_id: string
    nombre_empleado: string | null
    fecha: string | null
    hora_entrada: string | null
    hora_salida: string | null
    horas_trabajadas: number | null
    autoriza_entrada: string | null
    autoriza_salida: string | null
    estado: string | null
}

type FlotaAccesosRow = {
    id: string
    perfil_id: string
    nombre_completo: string | null
    documento_id: string | null
    cant_choferes: number | null
    cant_carga: number | null
    fecha: string | null
    hora_llegada: string | null
    hora_salida: string | null
    estado: string | null
    autorizado_por: string | null
    observacion: string | null
}

export interface Database {
    public: {
        Tables: {
            empleados: {
                Row: EmpleadoRow
                Insert: Partial<EmpleadoRow>
                Update: Partial<EmpleadoRow>
            }
            flota_perfil: {
                Row: FlotaPerfilRow
                Insert: Partial<FlotaPerfilRow>
                Update: Partial<FlotaPerfilRow>
            }
            programaciones: {
                Row: ProgramacionesRow
                Insert: Partial<ProgramacionesRow>
                Update: Partial<ProgramacionesRow>
            }
            whatsapp_mensajes: {
                Row: WhatsappMensajesRow
                Insert: Partial<WhatsappMensajesRow>
                Update: Partial<WhatsappMensajesRow>
            }
            telegram_usuarios: {
                Row: TelegramUsuariosRow
                Insert: Partial<TelegramUsuariosRow>
                Update: Partial<TelegramUsuariosRow>
            }
            sistema_config: {
                Row: SistemaConfigRow
                Insert: Partial<SistemaConfigRow>
                Update: Partial<SistemaConfigRow>
            }
            jornadas: {
                Row: JornadasRow
                Insert: Partial<JornadasRow>
                Update: Partial<JornadasRow>
            }
            flota_accesos: {
                Row: FlotaAccesosRow
                Insert: Partial<FlotaAccesosRow>
                Update: Partial<FlotaAccesosRow>
            }
        }
    }
}
