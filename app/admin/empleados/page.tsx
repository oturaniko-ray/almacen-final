'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { enviarEmail } from '@/emails/emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ------------------------------------------------------------
// COMPONENTES VISUALES INTERNOS – ESTILO UNIFICADO
// ------------------------------------------------------------

// Función para mostrar el rol en mayúsculas y con ortografía correcta
const formatearRol = (rol: string): string => {
  if (!rol) return 'USUARIO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin':
    case 'administrador':
      return 'ADMINISTRADOR';
    case 'supervisor':
      return 'SUPERVISOR';
    case 'tecnico':
      return 'TÉCNICO';
    case 'empleado':
      return 'EMPLEADO';
    default:
      return rol.toUpperCase();
  }
};

// ----- MEMBRETE SUPERIOR (sin subtítulo y sin línea) -----
const MemebreteSuperior = ({ usuario }: { usuario?: any }) => {
  const titulo = "GESTOR DE EMPLEADOS";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 text-center shadow-2xl mx-auto">
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{primerasPalabras} </span>
        <span className="text-blue-700">{ultimaPalabra}</span>
      </h1>
      {usuario && (
        <div className="mt-2">
          <span className="text-sm text-white normal-case">{usuario.nombre}</span>
          <span className="text-sm text-white mx-2">•</span>
          <span className="text-sm text-blue-500 normal-case">
            {formatearRol(usuario.rol)}
          </span>
          <span className="text-sm text-white ml-2">({usuario.nivel_acceso})</span>
        </div>
      )}
    </div>
  );
};

// ----- BOTÓN DE ACCIÓN (para cancelar y confirmar) -----
const BotonIcono = ({
  icono,
  onClick,
  color = 'bg-blue-600',
  disabled = false,
  type = 'button',
}: {
  icono: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`w-10 h-10 ${color} rounded-xl border border-white/5 
      active:scale-95 transition-transform shadow-lg flex items-center justify-center 
      disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl`}
  >
    {icono}
  </button>
);

// ----- CAMPO DE ENTRADA -----
const CampoEntrada = ({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  onEnter,
  autoFocus = false,
  disabled = false,
  textCentered = false,
  uppercase = false,
  className = '',
  label,
  required = false,
}: {
  type?: 'text' | 'password' | 'email' | 'number' | 'date';
  placeholder?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  textCentered?: boolean;
  uppercase?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) onEnter();
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[8px] font-black text-slate-500 uppercase ml-2">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        className={`w-full bg-white/5 border border-white/10 p-2.5 rounded-xl 
          text-[11px] font-bold text-white outline-none transition-colors
          disabled:opacity-70 disabled:cursor-not-allowed
          ${textCentered ? 'text-center' : ''} 
          ${uppercase ? 'uppercase' : ''}
          ${type === 'password' ? 'tracking-[0.4em]' : ''}
          focus:border-blue-500/50 hover:border-white/20
          ${disabled ? 'border-blue-500/30 text-amber-400' : ''}
          ${className}`}
      />
    </div>
  );
};

// ------------------------------------------------------------
// FUNCIÓN PARA ENVIAR CORREO (EMPLEADOS)
// ------------------------------------------------------------
const enviarCorreoEmpleado = async (empleado: any, to?: string) => {
  return enviarEmail('empleado', {
    nombre: empleado.nombre,
    documento_id: empleado.documento_id,
    email: empleado.email,
    rol: empleado.rol,
    nivel_acceso: empleado.nivel_acceso,
    pin_seguridad: empleado.pin_seguridad,
  }, to);
};

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al enviar correo');
    return { success: true };
  } catch (error: any) {
    console.error('Error enviando correo:', error);
    return { success: false, error: error.message };
  }
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
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  const router = useRouter();

  const estadoInicial = {
    nombre: '',
    documento_id: '',
    email: '',
    rol: 'empleado',
    activo: true,
    permiso_reportes: false,
    nivel_acceso: 1,
  };
  const [nuevo, setNuevo] = useState(estadoInicial);

  // ------------------------------------------------------------
  // MOSTRAR NOTIFICACIÓN
  // ------------------------------------------------------------
  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 2000);
  };

  // ------------------------------------------------------------
  // CARGAR SESIÓN Y DATOS
  // ------------------------------------------------------------
  const fetchEmpleados = useCallback(async () => {
    const { data } = await supabase
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
      supabase.removeChannel(channel);
    };
  }, [fetchEmpleados, router]);

  // ------------------------------------------------------------
  // OPCIONES DE NIVEL SEGÚN ROL
  // ------------------------------------------------------------
  const obtenerOpcionesNivel = () => {
    const r = nuevo.rol;
    if (r === 'empleado') return [1, 2];
    if (r === 'supervisor') return [3];
    if (r === 'admin') return [4, 5, 6, 7];
    if (r === 'tecnico') return [8, 9, 10];
    return [1];
  };

  // ------------------------------------------------------------
  // VALIDACIONES DE DUPLICADOS
  // ------------------------------------------------------------
  const validarDuplicados = async (): Promise<boolean> => {
    const { data: docExistente, error: errDoc } = await supabase
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
      mostrarNotificacion(`⚠️ El documento ID ya está registrado para ${docExistente.nombre}.`, 'advertencia');
      return false;
    }

    const { data: emailExistente, error: errEmail } = await supabase
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
      mostrarNotificacion(`⚠️ El email ya está registrado para ${emailExistente.nombre}.`, 'advertencia');
      return false;
    }

    return true;
  };

  // ------------------------------------------------------------
  // GUARDAR (CREAR O ACTUALIZAR) CON ENVÍO DE CORREO
  // ------------------------------------------------------------
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const esValido = await validarDuplicados();
      if (!esValido) {
        setLoading(false);
        return;
      }

      if (editando) {
        const { error } = await supabase
          .from('empleados')
          .update({
            nombre: nuevo.nombre,
            documento_id: nuevo.documento_id,
            email: nuevo.email.toLowerCase(),
            rol: nuevo.rol,
            activo: nuevo.activo,
            permiso_reportes: nuevo.permiso_reportes,
            nivel_acceso: nuevo.nivel_acceso,
          })
          .eq('id', editando.id);
        if (error) throw error;

        mostrarNotificacion('Empleado actualizado correctamente.', 'exito');
      } else {
        const { data: pinGenerado, error: pinError } = await supabase.rpc('generar_pin_personal');
        if (pinError) throw new Error('Error al generar PIN: ' + pinError.message);
        if (!pinGenerado) throw new Error('No se pudo generar el PIN');

        const { data: nuevoEmpleado, error } = await supabase
          .from('empleados')
          .insert([
            {
              nombre: nuevo.nombre,
              documento_id: nuevo.documento_id,
              email: nuevo.email.toLowerCase(),
              pin_seguridad: pinGenerado,
              rol: nuevo.rol,
              activo: nuevo.activo,
              permiso_reportes: nuevo.permiso_reportes,
              nivel_acceso: nuevo.nivel_acceso,
              pin_generado_en: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (error) throw error;

        const resultado = await enviarCorreoEmpleado(nuevoEmpleado);
        if (resultado.success) {
          mostrarNotificacion('Empleado creado y correo enviado correctamente.', 'exito');
        } else {
          mostrarNotificacion(`Empleado creado, pero falló el envío del correo: ${resultado.error}`, 'advertencia');
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
  // FUNCIÓN PARA REENVIAR CORREO
  // ------------------------------------------------------------
  const handleReenviarCorreo = async (empleado: any) => {
    setEnviandoCorreo(empleado.id);
    const resultado = await enviarCorreoEmpleado(empleado);
    setEnviandoCorreo(null);
    if (resultado.success) {
      mostrarNotificacion('Correo reenviado correctamente.', 'exito');
    } else {
      mostrarNotificacion(`Error al reenviar correo: ${resultado.error}`, 'error');
    }
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
      rol: emp.rol,
      activo: emp.activo,
      permiso_reportes: emp.permiso_reportes,
      nivel_acceso: emp.nivel_acceso,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ------------------------------------------------------------
  // EXPORTAR EXCEL
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const data = empleados.map((e) => ({
      Nombre: e.nombre,
      Documento: e.documento_id,
      Email: e.email,
      Rol: e.rol,
      Nivel: e.nivel_acceso,
      PIN: e.pin_seguridad,
      Activo: e.activo ? 'SÍ' : 'NO',
      Reportes: e.permiso_reportes ? 'SÍ' : 'NO',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados');
    XLSX.writeFile(wb, `Empleados_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ------------------------------------------------------------
  // FILTRAR EMPLEADOS
  // ------------------------------------------------------------
  const empleadosFiltrados = empleados.filter(
    (e) =>
      e.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      e.documento_id?.toLowerCase().includes(filtro.toLowerCase()) ||
      e.email?.toLowerCase().includes(filtro.toLowerCase())
  );

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-black p-4 md:p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        {/* NOTIFICACIÓN FLOTANTE */}
        {notificacion.tipo && (
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl font-bold text-sm shadow-2xl animate-flash-fast max-w-[90%] text-center border-2 ${
            notificacion.tipo === 'exito' ? 'bg-emerald-500 border-emerald-400' :
            notificacion.tipo === 'error' ? 'bg-rose-500 border-rose-400' :
            'bg-amber-500 border-amber-400'
          } text-white flex items-center gap-3`}>
            <span className="text-lg">
              {notificacion.tipo === 'exito' ? '✅' : notificacion.tipo === 'error' ? '❌' : '⚠️'}
            </span>
            <span>{notificacion.mensaje}</span>
          </div>
        )}

        {/* HEADER CON MEMBRETE Y BOTONES */}
        <div className="relative w-full mb-6">
          <MemebreteSuperior usuario={user} />
          <div className="absolute top-0 right-0 flex gap-3 mt-6 mr-6">
            <button
              onClick={exportarExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
            >
              EXPORTAR
            </button>
            <button
              onClick={() => router.push('/admin')}
              className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
            >
              REGRESAR
            </button>
          </div>
        </div>

        {/* CONTENEDOR STICKY (formulario + búsqueda) */}
        <div className="sticky top-0 z-40 bg-black pt-2 pb-4 space-y-4">
          {/* FORMULARIO */}
          <div className={`bg-[#0f172a] p-4 rounded-[25px] border transition-all ${editando ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5'}`}>
            <form onSubmit={handleGuardar} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-3">
                {/* Campos principales */}
                <CampoEntrada
                  label="NOMBRE"
                  placeholder="Nombre completo"
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                  required
                  autoFocus
                  className="lg:col-span-1"
                />
                <CampoEntrada
                  label="DOCUMENTO"
                  placeholder="DNI / NIE"
                  value={nuevo.documento_id}
                  onChange={(e) => setNuevo({ ...nuevo, documento_id: e.target.value })}
                  required
                  uppercase
                  className="lg:col-span-1"
                />
                <CampoEntrada
                  label="EMAIL"
                  placeholder="correo@ejemplo.com"
                  type="email"
                  value={nuevo.email}
                  onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                  required
                  className="lg:col-span-1"
                />

                {/* Rol */}
                <div className="flex flex-col gap-1 lg:col-span-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase ml-2">ROL</label>
                  <select
                    value={nuevo.rol}
                    onChange={(e) =>
                      setNuevo({
                        ...nuevo,
                        rol: e.target.value,
                        nivel_acceso:
                          e.target.value === 'supervisor'
                            ? 3
                            : e.target.value === 'admin'
                            ? 4
                            : e.target.value === 'tecnico'
                            ? 8
                            : 1,
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/50 uppercase tracking-wider"
                  >
                    <option value="empleado">EMPLEADO</option>
                    <option value="supervisor">SUPERVISOR</option>
                    <option value="admin">ADMINISTRADOR</option>
                    <option value="tecnico">TÉCNICO</option>
                  </select>
                </div>

                {/* Nivel */}
                <div className="flex flex-col gap-1 lg:col-span-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase ml-2">NIVEL</label>
                  <select
                    value={nuevo.nivel_acceso}
                    onChange={(e) => setNuevo({ ...nuevo, nivel_acceso: parseInt(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/50"
                  >
                    {obtenerOpcionesNivel().map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Reportes */}
                <div className="flex flex-col gap-1 lg:col-span-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase ml-2">REPORTES</label>
                  <select
                    value={nuevo.permiso_reportes ? 'si' : 'no'}
                    onChange={(e) => setNuevo({ ...nuevo, permiso_reportes: e.target.value === 'si' })}
                    className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/50"
                  >
                    <option value="no">NO</option>
                    <option value="si">SÍ</option>
                  </select>
                </div>

                {/* PIN (solo en edición) */}
                {editando && (
                  <CampoEntrada
                    label="PIN ASIGNADO"
                    value={editando.pin_seguridad || ''}
                    disabled
                    textCentered
                    uppercase
                    className="border-blue-500/30 lg:col-span-1"
                  />
                )}

                {/* Botones de acción */}
                <div className="flex items-end gap-2 lg:col-span-2 justify-end">
                  <BotonIcono
                    icono="🚫"
                    onClick={cancelarEdicion}
                    color="bg-rose-600"
                    type="button"
                  />
                  <BotonIcono
                    icono="✅"
                    onClick={() => {}}
                    color="bg-emerald-600"
                    type="submit"
                    disabled={loading}
                  />
                </div>
              </div>
            </form>
          </div>

          {/* BARRA DE BÚSQUEDA */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] bg-[#0f172a] p-1 rounded-xl border border-white/5 flex items-center">
              <span className="text-white/40 ml-3">🔍</span>
              <input
                type="text"
                placeholder="BUSCAR EMPLEADO..."
                className="w-full bg-transparent px-3 py-2 text-[11px] font-bold uppercase outline-none text-white"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              {filtro && (
                <button
                  onClick={() => setFiltro('')}
                  className="mr-2 text-white/60 hover:text-white transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABLA CON SCROLL Y ENCABEZADO FIJO */}
        <div className="bg-[#0f172a] rounded-[25px] border border-white/5 overflow-hidden max-h-[60vh] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0f172a] text-[10px] font-black text-slate-400 uppercase tracking-wider sticky top-0 z-30 border-b border-white/10">
                <tr>
                  <th className="p-4">Empleado</th>
                  <th className="p-4">Documento / Email</th>
                  <th className="p-4 text-center">Rol</th>
                  <th className="p-4 text-center">Nivel</th>
                  <th className="p-4 text-center">PIN</th>
                  <th className="p-4 text-center">Reportes</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center" colSpan={2}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            emp.en_almacen
                              ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                              : 'bg-white/20'
                          }`}
                        />
                        <span className="font-bold text-[13px] uppercase text-white">
                          {emp.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-[12px] font-mono">
                        <span className="block text-white">{emp.documento_id}</span>
                        <span className="text-slate-500 text-[11px]">{emp.email}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-[11px] font-black uppercase text-blue-400">
                        {emp.rol}
                      </span>
                    </td>
                    <td className="p-4 text-center font-black text-white">
                      {emp.nivel_acceso}
                    </td>
                    <td className="p-4 text-center">
                      <div className="group relative inline-block">
                        <span className="text-[11px] font-mono text-slate-600 group-hover:hidden tracking-widest">
                          ••••••
                        </span>
                        <span className="text-[11px] font-mono text-amber-500 hidden group-hover:block font-bold">
                          {emp.pin_seguridad}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-full ${
                          emp.permiso_reportes
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {emp.permiso_reportes ? 'SÍ' : 'NO'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={async () => {
                          await supabase
                            .from('empleados')
                            .update({ activo: !emp.activo })
                            .eq('id', emp.id);
                        }}
                        className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                          emp.activo
                            ? 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10'
                            : 'text-rose-500 border-rose-500/30 hover:bg-rose-500/10'
                        }`}
                      >
                        {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => editarEmpleado(emp)}
                        className="text-blue-500 hover:text-white font-black text-[10px] uppercase px-3 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all"
                      >
                        EDITAR
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleReenviarCorreo(emp)}
                        disabled={enviandoCorreo === emp.id}
                        className="text-emerald-500 hover:text-white font-black text-[10px] uppercase px-3 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        {enviandoCorreo === emp.id ? '...' : '📧 REENVIAR'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {empleadosFiltrados.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-slate-500 text-[11px] uppercase tracking-widest">
                No hay empleados que coincidan con la búsqueda.
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast {
          animation: flash-fast 2s ease-in-out;
        }
        select option {
          background-color: #1f2937;
          color: white;
        }
      `}</style>
    </main>
  );
}