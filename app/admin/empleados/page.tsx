'use client';
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { getAuthHeaders } from '@/lib/apiClient';
import {
  CampoEntrada,
  SelectOpcion,
  Buscador,
  NotificacionSistema
} from '../../components';

// ------------------------------------------------------------
// DEFINICIÓN DE TIPOS PARA SUPABASE
// ------------------------------------------------------------
type EmpleadoUpdate = {
  nombre: string;
  documento_id: string;
  email: string;
  telefono: string;
  rol: string;
  activo: boolean;
  permiso_reportes: boolean;
  nivel_acceso: number;
};

type EmpleadoInsert = EmpleadoUpdate & {
  pin_seguridad: string;
  pin_generado_en: string;
};

// ------------------------------------------------------------
// COMPONENTE MODAL DE CONFIRMACIÓN
// ------------------------------------------------------------
const ModalConfirmacion = ({
  isOpen,
  onClose,
  onConfirm,
  mensaje,
  email
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mensaje: string;
  email: string | null;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border-2 border-blue-500/30 rounded-[30px] p-6 max-w-md w-full shadow-2xl animate-modal-appear">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-black text-lg uppercase flex items-center gap-2">
            <span className="text-2xl">📧</span> CONFIRMAR ENVÍO
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
            ✕
          </button>
        </div>

        <div className="bg-[#0f172a] p-5 rounded-2xl border border-white/10 mb-4">
          <p className="text-white text-base leading-relaxed">{mensaje}</p>
          {email && (
            <div className="mt-3 flex items-center gap-2 text-sm bg-blue-600/20 p-3 rounded-xl border border-blue-500/30">
              <span className="text-blue-400">📨</span>
              <span className="text-blue-300 font-mono">{email}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-black py-3 rounded-xl text-sm uppercase tracking-wider transition-all active:scale-95"
          >
            CANCELAR
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-sm uppercase tracking-wider transition-all active:scale-95"
          >
            ENVIAR
          </button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// FUNCIONES AUXILIARES
// ------------------------------------------------------------

const formatearRol = (rol: string): string => {
  if (!rol) return 'USUARIO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin': case 'administrador': return 'ADMIN';
    case 'supervisor': return 'SUPERV';
    case 'tecnico': return 'TECNICO';
    case 'empleado': return 'EMPLEADO';
    default: return rol.toUpperCase();
  }
};

const getTimestamp = () => {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
  const dia = ahora.getDate().toString().padStart(2, '0');
  const hora = ahora.getHours().toString().padStart(2, '0');
  const minuto = ahora.getMinutes().toString().padStart(2, '0');
  const segundo = ahora.getSeconds().toString().padStart(2, '0');
  return `${año}${mes}${dia}_${hora}${minuto}${segundo}`;
};

// ------------------------------------------------------------
// MEMBRETE SUPERIOR - DISTRIBUIDO SIN ESPACIOS
// ------------------------------------------------------------
const MemebreteSuperior = ({ usuario, onExportar, onRegresar, onSincronizar }: { usuario?: any; onExportar: () => void; onRegresar: () => void; onSincronizar: () => void }) => {
  const titulo = "GESTOR DE EMPLEADOS";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="w-full mb-4">
      <div className="w-full bg-[#1a1a1a] px-6 py-4 rounded-[25px] border border-white/5 shadow-2xl flex items-center justify-between">
        {/* Título y usuario a la izquierda */}
        <div className="flex flex-col">
          <h1 className="text-xl font-black italic uppercase tracking-tighter">
            <span className="text-white">{primerasPalabras} </span>
            <span className="text-blue-700">{ultimaPalabra}</span>
          </h1>
          {usuario && (
            <div className="text-sm">
              <span className="text-white">{usuario.nombre}</span>
              <span className="text-white mx-1">•</span>
              <span className="text-blue-500">{formatearRol(usuario.rol)}</span>
              <span className="text-white ml-1">({usuario.nivel_acceso})</span>
            </div>
          )}
        </div>

        {/* Botones a la derecha */}
        <div className="flex gap-2">
          <button
            onClick={onSincronizar}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
          >
            🔄 SINCRONIZAR
          </button>
          <button
            onClick={onExportar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
          >
            EXPORTAR
          </button>
          <button
            onClick={onRegresar}
            className="bg-blue-800 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
          >
            REGRESAR
          </button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function GestionEmpleados() {
  const [user, setUser] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState<string | null>(null);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState<string | null>(null);
  const [enviandoTelegram, setEnviandoTelegram] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  const [modalConfirmacion, setModalConfirmacion] = useState<{ isOpen: boolean; empleado: any | null }>({ isOpen: false, empleado: null });
  const router = useRouter();

  const estadoInicial = {
    nombre: '',
    documento_id: '',
    email: '',
    telefono: '',
    rol: 'empleado',
    activo: true,
    permiso_reportes: false,
    nivel_acceso: 1,
  };
  const [nuevo, setNuevo] = useState(estadoInicial);

  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 2000);
  };

  const fetchEmpleados = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('empleados')
      .select('*')
      .order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 4) {
      router.replace('/admin');
      return;
    }
    setUser(currentUser);
    fetchEmpleados();

    const channel = supabase
      .channel('empleados_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, fetchEmpleados)
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(error => {
        console.error('Error removing channel:', error);
      });
    };
  }, [fetchEmpleados, router]);

  const obtenerOpcionesNivel = () => {
    const r = nuevo.rol;
    if (r === 'empleado') return [1, 2];
    if (r === 'supervisor') return [3];
    if (r === 'admin') return [4, 5, 6, 7];
    if (r === 'tecnico') return [8, 9, 10];
    return [1];
  };

  const validarDuplicados = async (): Promise<boolean> => {
    const { data: docExistente, error: errDoc } = await (supabase as any)
      .from('empleados')
      .select('id, nombre')
      .eq('documento_id', nuevo.documento_id)
      .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (errDoc) {
      mostrarNotificacion('Error al validar documento ID', 'error');
      return false;
    }

    if (docExistente) {
      const existente = docExistente as { id: string; nombre: string };
      mostrarNotificacion(`⚠️ El documento ID ya está registrado para ${existente.nombre}.`, 'advertencia');
      return false;
    }

    const { data: emailExistente, error: errEmail } = await (supabase as any)
      .from('empleados')
      .select('id, nombre')
      .eq('email', nuevo.email.toLowerCase())
      .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (errEmail) {
      mostrarNotificacion('Error al validar email', 'error');
      return false;
    }

    if (emailExistente) {
      const existente = emailExistente as { id: string; nombre: string };
      mostrarNotificacion(`⚠️ El email ya está registrado para ${existente.nombre}.`, 'advertencia');
      return false;
    }

    return true;
  };

  // --- FUNCIÓN: enviar correo usando fetch a la API ---
  const enviarCorreoEmpleado = async (empleado: any, to?: string) => {
    setEnviandoCorreo(empleado.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tipo: 'empleado',
          datos: {
            nombre: empleado.nombre,
            documento_id: empleado.documento_id,
            email: empleado.email,
            rol: empleado.rol,
            nivel_acceso: empleado.nivel_acceso,
            pin_seguridad: empleado.pin_seguridad,
          },
          to: to || empleado.email,
        }),
      });
      const result = await response.json();
      if (result.success) {
        mostrarNotificacion('Correo enviado correctamente.', 'exito');
      } else {
        mostrarNotificacion(`Error al enviar correo: ${result.error}`, 'error');
      }
      return result;
    } catch (error: any) {
      console.error('Error en fetch de correo:', error);
      mostrarNotificacion(`Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    } finally {
      setEnviandoCorreo(null);
    }
  };

  // --- FUNCIÓN: enviar WhatsApp ---
  const handleEnviarWhatsApp = async (empleado: any) => {
    if (!empleado.telefono) {
      mostrarNotificacion('El empleado no tiene teléfono registrado', 'advertencia');
      return;
    }

    setEnviandoWhatsApp(empleado.id);

    const mensaje = `Hola ${empleado.nombre}, este es un mensaje del sistema de gestión.\nTu PIN de acceso es: ${empleado.pin_seguridad}.\nPuedes ingresar en: https://almacen-final.vercel.app/`;

    try {
      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          to: empleado.telefono,
          message: mensaje
        }),
      });
      const resultado = await response.json();

      if (resultado.success) {
        mostrarNotificacion('WhatsApp enviado correctamente', 'exito');
      } else {
        mostrarNotificacion(`Error WhatsApp: ${resultado.error}`, 'error');
      }
    } catch (error: any) {
      mostrarNotificacion(`Error: ${error.message}`, 'error');
    } finally {
      setEnviandoWhatsApp(null);
    }
  };

  // --- FUNCIÓN: enviar Telegram (MEJORADA) ---
  const handleEnviarTelegram = async (empleado: any) => {
    if (!empleado.telefono) {
      mostrarNotificacion('El empleado no tiene teléfono registrado', 'advertencia');
      return;
    }

    setEnviandoTelegram(empleado.id);

    try {
      const { data: telegramUser, error } = await (supabase as any)
        .from('telegram_usuarios')
        .select('chat_id')
        .eq('empleado_id', empleado.id)
        .maybeSingle();

      if (error) throw error;

      if (!telegramUser) {
        mostrarNotificacion(
          '❌ El empleado no ha iniciado conversación con @Notificaacceso_bot',
          'error'
        );
        setEnviandoTelegram(null);
        return;
      }

      const mensaje = `🔐 *Credenciales de acceso*\n\nHola *${empleado.nombre}*,\nTu PIN de acceso es: *${empleado.pin_seguridad}*\n\nPuedes ingresar en: https://almacen-final.vercel.app/`;

      const response = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          chat_id: telegramUser.chat_id,
          text: mensaje
        }),
      });

      const resultado = await response.json();

      if (resultado.ok) {
        mostrarNotificacion('✅ Telegram enviado correctamente', 'exito');
      } else {
        mostrarNotificacion(`❌ Error Telegram: ${resultado.description || 'Error desconocido'}`, 'error');
      }
    } catch (error: any) {
      console.error('Error en Telegram:', error);
      mostrarNotificacion(`❌ Error: ${error.message}`, 'error');
    } finally {
      setEnviandoTelegram(null);
    }
  };

  // --- FUNCIÓN: cambiar estado activo/inactivo ---
  const toggleActivo = async (empleado: any) => {
    try {
      const { error } = await (supabase as any)
        .from('empleados')
        .update({ activo: !empleado.activo })
        .eq('id', empleado.id);

      if (error) throw error;

      mostrarNotificacion(
        empleado.activo ? 'Empleado desactivado' : 'Empleado activado',
        'exito'
      );
      fetchEmpleados();
    } catch (error: any) {
      mostrarNotificacion(`Error: ${error.message}`, 'error');
    }
  };

  // ------------------------------------------------------------
  // GUARDAR (CREAR O ACTUALIZAR)
  // ------------------------------------------------------------
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const esValido = await validarDuplicados();
      if (!esValido) { setLoading(false); return; }

      if (editando) {
        const updateData = {
          nombre: nuevo.nombre,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          telefono: nuevo.telefono,
          rol: nuevo.rol,
          activo: nuevo.activo,
          permiso_reportes: nuevo.permiso_reportes,
          nivel_acceso: nuevo.nivel_acceso,
        };

        const { error } = await (supabase as any)
          .from('empleados')
          .update(updateData)
          .eq('id', editando.id);

        if (error) throw error;
        mostrarNotificacion('Empleado actualizado correctamente.', 'exito');
      } else {
        const { data: pinGenerado, error: pinError } = await (supabase as any).rpc('generar_pin_personal');
        if (pinError) throw new Error('Error al generar PIN: ' + pinError.message);
        if (!pinGenerado) throw new Error('No se pudo generar el PIN');

        const insertData = [{
          nombre: nuevo.nombre,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          telefono: nuevo.telefono,
          pin_seguridad: pinGenerado,
          rol: nuevo.rol,
          activo: nuevo.activo,
          permiso_reportes: nuevo.permiso_reportes,
          nivel_acceso: nuevo.nivel_acceso,
          pin_generado_en: new Date().toISOString(),
        }];

        const { data: nuevoEmpleado, error } = await (supabase as any)
          .from('empleados')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        if (nuevo.email) {
          setModalConfirmacion({
            isOpen: true,
            empleado: nuevoEmpleado
          });
        } else {
          mostrarNotificacion('Empleado creado correctamente.', 'exito');
        }
      }

      cancelarEdicion();
    } catch (error: any) {
      console.error(error);
      mostrarNotificacion(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // FUNCIÓN PARA REENVIAR CORREO (CON MODAL)
  // ------------------------------------------------------------
  const handleReenviarCorreo = (empleado: any) => {
    if (!empleado.email) {
      mostrarNotificacion('El empleado no tiene email para reenviar.', 'advertencia');
      return;
    }
    setModalConfirmacion({
      isOpen: true,
      empleado: empleado
    });
  };

  // ------------------------------------------------------------
  // CANCELAR EDICIÓN
  // ------------------------------------------------------------
  const cancelarEdicion = () => {
    setEditando(null);
    setNuevo(estadoInicial);
  };

  // ------------------------------------------------------------
  // EDITAR EMPLEADO
  // ------------------------------------------------------------
  const editarEmpleado = (emp: any) => {
    setEditando(emp);
    setNuevo({
      nombre: emp.nombre,
      documento_id: emp.documento_id,
      email: emp.email,
      telefono: emp.telefono || '',
      rol: emp.rol,
      activo: emp.activo,
      permiso_reportes: emp.permiso_reportes,
      nivel_acceso: emp.nivel_acceso,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ------------------------------------------------------------
  // EXPORTAR EXCEL - UNIFICADO
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = empleados.map((e) => ({
      Nombre: e.nombre,
      Documento: e.documento_id,
      Email: e.email,
      Teléfono: e.telefono || '',
      Rol: e.rol,
      Nivel: e.nivel_acceso,
      PIN: e.pin_seguridad,
      Activo: e.activo ? 'SÍ' : 'NO',
      Reportes: e.permiso_reportes ? 'SÍ' : 'NO',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const columnWidths = [
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
      { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    ];
    ws['!cols'] = columnWidths;

    const fechaEmision = new Date().toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const titulo = `GESTOR DE EMPLEADOS`;
    const empleadoInfo = user ? `${user.nombre} - ${formatearRol(user.rol)} (Nivel ${user.nivel_acceso})` : 'Sistema';
    const fechaInfo = `Fecha de emisión: ${fechaEmision}`;

    XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(ws, [[empleadoInfo]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(ws, [[fechaInfo]], { origin: 'A3' });
    XLSX.utils.sheet_add_aoa(ws, [['─────────────────────────────────────────────────────────────────']], { origin: 'A4' });

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const newData = XLSX.utils.sheet_to_json(ws, { header: 1, range: 5 });
    if (newData.length > 0) {
      XLSX.utils.sheet_add_aoa(ws, newData as any[][], { origin: 'A6' });
    }

    XLSX.utils.book_append_sheet(wb, ws, "Empleados");
    const timestamp = getTimestamp();
    const filename = `empleados_${timestamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    mostrarNotificacion('✅ ARCHIVO EXPORTADO', 'exito');
  };

  // ------------------------------------------------------------
  // REGRESAR
  // ------------------------------------------------------------
  const handleRegresar = () => {
    router.push('/admin');
  };

  const handleSincronizarMasiva = () => {
    router.push('/admin/sincronizar-masiva');
  };

  // ------------------------------------------------------------
  // FILTRAR EMPLEADOS
  // ------------------------------------------------------------
  const empleadosFiltrados = empleados.filter(
    (e) =>
      e.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      e.documento_id?.toLowerCase().includes(filtro.toLowerCase()) ||
      e.email?.toLowerCase().includes(filtro.toLowerCase()) ||
      (e.telefono && e.telefono.includes(filtro))
  );

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-black p-3 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        {/* NOTIFICACIÓN FLOTANTE */}
        <NotificacionSistema
          mensaje={notificacion.mensaje}
          tipo={notificacion.tipo}
          visible={!!notificacion.tipo}
          duracion={2000}
          onCerrar={() => setNotificacion({ mensaje: '', tipo: null })}
        />

        {/* HEADER - DISTRIBUIDO SIN ESPACIOS */}
        <MemebreteSuperior
          usuario={user}
          onExportar={exportarExcel}
          onRegresar={handleRegresar}
          onSincronizar={handleSincronizarMasiva}
        />

        {/* FORMULARIO - Grid 9 columnas */}
        <div className={`bg-[#0f172a] p-3 rounded-xl border transition-all mb-3 ${editando ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5'}`}>
          <form onSubmit={handleGuardar}>
            <div className="grid grid-cols-9 gap-2">

              {/* Col 1: NOMBRE */}
              <div className="col-span-1">
                <CampoEntrada
                  label="NOMBRE"
                  placeholder="Nombre"
                  valor={nuevo.nombre}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, nombre: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              {/* Col 2: DOCUMENTO */}
              <div className="col-span-1">
                <CampoEntrada
                  label="DOCUMENTO"
                  placeholder="DNI"
                  valor={nuevo.documento_id}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, documento_id: e.target.value })}
                  required
                  mayusculas
                />
              </div>

              {/* Col 3: EMAIL */}
              <div className="col-span-1">
                <CampoEntrada
                  label="EMAIL"
                  placeholder="Email"
                  tipo="email"
                  valor={nuevo.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, email: e.target.value })}
                  required
                />
              </div>

              {/* Col 4: TELÉFONO */}
              <div className="col-span-1">
                <CampoEntrada
                  label="TELÉFONO"
                  placeholder="+34 XXX XXX XXX"
                  valor={nuevo.telefono}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, telefono: e.target.value })}
                />
              </div>

              {/* Col 5: ROL */}
              <div className="col-span-1">
                <SelectOpcion
                  label="ROL"
                  value={nuevo.rol}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setNuevo({
                      ...nuevo,
                      rol: e.target.value,
                      nivel_acceso:
                        e.target.value === 'supervisor' ? 3 :
                          e.target.value === 'admin' ? 4 :
                            e.target.value === 'tecnico' ? 8 : 1,
                    })
                  }
                  options={[
                    { value: 'empleado', label: 'EMPLEADO' },
                    { value: 'supervisor', label: 'SUPERVISOR' },
                    { value: 'admin', label: 'ADMIN' },
                    { value: 'tecnico', label: 'TECNICO' }
                  ]}
                />
              </div>

              {/* Col 6: NIVEL */}
              <div className="col-span-1">
                <SelectOpcion
                  label="NIVEL"
                  value={nuevo.nivel_acceso}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNuevo({ ...nuevo, nivel_acceso: parseInt(e.target.value) })}
                  options={obtenerOpcionesNivel().map(n => ({ value: n, label: n.toString() }))}
                />
              </div>

              {/* Col 7: REPORTES */}
              <div className="col-span-1">
                <SelectOpcion
                  label="REPORTES"
                  value={nuevo.permiso_reportes ? 'si' : 'no'}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNuevo({ ...nuevo, permiso_reportes: e.target.value === 'si' })}
                  options={[
                    { value: 'no', label: 'NO' },
                    { value: 'si', label: 'SÍ' }
                  ]}
                />
              </div>

              {/* Col 8: PIN (solo edición) */}
              {editando && (
                <div className="col-span-1">
                  <CampoEntrada
                    label="PIN"
                    valor={editando.pin_seguridad || ''}
                    onChange={() => { }}
                    disabled
                    mayusculas
                    className="border-blue-500/30"
                  />
                </div>
              )}

              {/* Col 9: BOTONES - ESTILO FLOTA (sin BotonIcono) */}
              <div className="col-span-1 flex flex-col items-stretch justify-center gap-1">
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase py-2 rounded-lg transition-all"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase py-2 rounded-lg transition-all disabled:opacity-50"
                >
                  {loading ? '...' : 'ACEPTAR'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* BUSCADOR */}
        <div className="mb-3">
          <Buscador
            placeholder="BUSCAR EMPLEADO..."
            value={filtro}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFiltro(e.target.value)}
            onClear={() => setFiltro('')}
          />
        </div>

        {/* TABLA - Con distribución de 2 columnas: nombre+documento | email+teléfono */}
        <div className="bg-[#0f172a] rounded-xl border border-white/5 overflow-hidden max-h-[60vh] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ minWidth: '1200px' }}>
              <thead className="bg-[#0f172a] text-[9px] font-black text-slate-400 uppercase tracking-wider sticky top-0 z-30 border-b border-white/10">
                <tr>
                  <th className="p-3 w-[15%]">NOMBRE / DOC</th>
                  <th className="p-3 w-[20%]">EMAIL / TEL</th>
                  <th className="p-3 text-center w-[8%]">ROL</th>
                  <th className="p-3 text-center w-[6%]">NIV</th>
                  <th className="p-3 text-center w-[8%]">PIN</th>
                  <th className="p-3 text-center w-[6%]">REP</th>
                  <th className="p-3 text-center w-[6%]">EST</th>
                  <th className="p-3 text-center w-[31%]" colSpan={4}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* COLUMNA 1: NOMBRE + DOCUMENTO */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {/* INDICADOR VERDE PARA EN_ALMACEN */}
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            emp.en_almacen 
                              ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' 
                              : 'bg-slate-600'
                          }`}
                          title={emp.en_almacen ? 'En almacén' : 'Fuera del almacén'}
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-sm uppercase text-white truncate" title={emp.nombre}>
                            {emp.nombre.length > 20 ? emp.nombre.substring(0, 18) + '...' : emp.nombre}
                          </span>
                          <span className="text-slate-400 text-[10px] font-mono truncate" title={emp.documento_id}>
                            {emp.documento_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* COLUMNA 2: EMAIL + TELÉFONO */}
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-[10px] truncate" title={emp.email}>
                          {emp.email}
                        </span>
                        {emp.telefono && (
                          <span className="text-emerald-500 text-[10px] truncate">
                            📱 {emp.telefono}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 text-center text-[10px] font-black uppercase text-blue-400">
                      {formatearRol(emp.rol)}
                    </td>
                    <td className="p-3 text-center font-black text-white text-[11px]">{emp.nivel_acceso}</td>
                    <td className="p-3 text-center">
                      <div className="group relative inline-block">
                        <span className="text-[10px] font-mono text-slate-600 group-hover:hidden tracking-widest">••••••</span>
                        <span className="text-[10px] font-mono text-amber-500 hidden group-hover:block font-bold">{emp.pin_seguridad}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${emp.permiso_reportes ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {emp.permiso_reportes ? 'SÍ' : 'NO'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {/* BOTÓN DE ACTIVO/INACTIVO - CLICABLE */}
                      <button
                        onClick={() => toggleActivo(emp)}
                        className={`px-2 py-1 rounded-full text-[9px] font-black transition-all cursor-pointer hover:scale-105 ${emp.activo
                          ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                          : 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30'
                          }`}
                        title={emp.activo ? 'Activo (haz clic para desactivar)' : 'Inactivo (haz clic para activar)'}
                      >
                        {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col gap-1 items-stretch justify-center w-full min-w-[70px]">
                        <button
                          onClick={() => editarEmpleado(emp)}
                          className="text-blue-500 hover:text-white font-black text-[9px] uppercase px-2 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all text-center"
                        >
                          EDITAR
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col gap-1 items-stretch justify-center w-full min-w-[70px]">
                        <button
                          onClick={() => handleReenviarCorreo(emp)}
                          disabled={enviandoCorreo === emp.id}
                          className="text-emerald-500 hover:text-white font-black text-[9px] uppercase px-2 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 text-center"
                        >
                          {enviandoCorreo === emp.id ? '...' : 'EMAIL'}
                        </button>
                        <button
                          onClick={() => handleEnviarWhatsApp(emp)}
                          disabled={enviandoWhatsApp === emp.id || !emp.telefono}
                          className={`text-green-500 hover:text-white font-black text-[9px] uppercase px-2 py-1.5 rounded-lg border transition-all text-center ${emp.telefono ? 'border-green-500/20 hover:bg-green-600' : 'border-gray-500/20 hover:bg-gray-600 disabled:opacity-50'}`}
                        >
                          {enviandoWhatsApp === emp.id ? '...' : 'WHATSAPP'}
                        </button>
                        <button
                          onClick={() => handleEnviarTelegram(emp)}
                          disabled={enviandoTelegram === emp.id || !emp.telefono}
                          className={`text-blue-400 hover:text-white font-black text-[9px] uppercase px-2 py-1.5 rounded-lg border transition-all text-center ${emp.telefono ? 'border-blue-400/20 hover:bg-blue-600' : 'border-gray-500/20 hover:bg-gray-600 disabled:opacity-50'}`}
                        >
                          {enviandoTelegram === emp.id ? '...' : 'TELEGRAM'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {empleadosFiltrados.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">No hay empleados que coincidan con la búsqueda.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmación para envío de correo */}
      <ModalConfirmacion
        isOpen={modalConfirmacion.isOpen}
        onClose={() => setModalConfirmacion({ isOpen: false, empleado: null })}
        onConfirm={() => {
          if (modalConfirmacion.empleado) {
            enviarCorreoEmpleado(modalConfirmacion.empleado);
          }
        }}
        mensaje="¿Deseas enviar un correo con las credenciales de acceso?"
        email={modalConfirmacion.empleado?.email || null}
      />

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
        @keyframes modal-appear {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-appear { animation: modal-appear 0.3s ease-out; }
        select option { background-color: #1f2937; color: white; }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          opacity: 0.5;
          height: 24px;
        }
      `}</style>
    </main>
  );
}