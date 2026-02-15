'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { enviarEmail } from '@/emails/emailService';

// Al inicio del archivo, con los otros imports
const enviarCorreoFlota = async (perfil: any, to?: string) => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'flota',
        to: to || perfil.email,
        nombre_completo: perfil.nombre_completo,
        documento_id: perfil.documento_id,
        nombre_flota: perfil.nombre_flota || '',
        cant_choferes: perfil.cant_choferes || 1,
        cant_rutas: perfil.cant_rutas || 0,
        pin_secreto: perfil.pin_secreto,
        email: perfil.email,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ------------------------------------------------------------
// COMPONENTES VISUALES INTERNOS – ESTILO UNIFICADO
// ------------------------------------------------------------

// Función para formatear rol
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
  const titulo = "GESTOR DE FLOTA";
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

// ----- BOTÓN DE ACCIÓN -----
const BotonAccion = ({
  texto,
  icono,
  onClick,
  color = 'bg-blue-600',
  disabled = false,
  loading = false,
  fullWidth = true,
  className = '',
}: {
  texto: string;
  icono?: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`${fullWidth ? 'w-full' : ''} ${color} p-2 rounded-xl border border-white/5 
      active:scale-95 transition-transform shadow-lg flex items-center justify-center gap-2 
      disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase text-[11px] tracking-wider
      ${className}`}
  >
    {icono && <span className="text-lg">{icono}</span>}
    {loading ? (
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-150" />
        <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-300" />
      </span>
    ) : (
      texto
    )}
  </button>
);

// ----- BOTÓN ICONO (para cancelar y confirmar) -----
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

// ----- SELECT (para choferes y rutas) -----
const SelectOpcion = ({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: number;
  onChange: (value: number) => void;
  options: number[];
  label: string;
  className?: string;
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-[8px] font-black text-slate-500 uppercase ml-2">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className={`w-full bg-white/5 border border-white/10 p-2.5 rounded-xl 
        text-[11px] font-bold text-white outline-none focus:border-blue-500/50
        ${className}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-gray-800 text-white">
          {opt}
        </option>
      ))}
    </select>
  </div>
);

// ------------------------------------------------------------
// FUNCIÓN PARA ENVIAR CORREO (FLOTA) – OPCIONAL
// ------------------------------------------------------------
// Reemplazar la función actual (líneas 74-94 aprox) con:

const enviarCorreoFlota = async (perfil: any, to?: string) => {
  return enviarEmail('flota', {
    nombre_completo: perfil.nombre_completo,
    documento_id: perfil.documento_id,
    email: perfil.email,
    nombre_flota: perfil.nombre_flota || '',
    cant_choferes: perfil.cant_choferes || 1,
    cant_rutas: perfil.cant_rutas || 0,
    pin_secreto: perfil.pin_secreto,
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
// COMPONENTE PRINCIPAL – GESTIÓN DE PERFILES DE FLOTA
// ------------------------------------------------------------
export default function GestionFlota() {
  const [user, setUser] = useState<any>(null);
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  const router = useRouter();

  const estadoInicial = {
    nombre_completo: '',
    documento_id: '',
    email: '',
    nombre_flota: '',
    cant_choferes: 1,
    cant_rutas: 0,
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
  const fetchPerfiles = useCallback(async () => {
    const { data } = await supabase
      .from('flota_perfil')
      .select('*')
      .order('nombre_completo', { ascending: true });
    if (data) setPerfiles(data);
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 5) {
      router.replace('/admin');
      return;
    }
    setUser(currentUser);
    fetchPerfiles();

    const channel = supabase
      .channel('flota_perfil_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flota_perfil' }, fetchPerfiles)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPerfiles, router]);

  // ------------------------------------------------------------
  // VALIDACIONES DE DUPLICADOS
  // ------------------------------------------------------------
  const validarDuplicados = async (): Promise<boolean> => {
    const { data: docExistente, error: errDoc } = await supabase
      .from('flota_perfil')
      .select('id, nombre_completo')
      .eq('documento_id', nuevo.documento_id)
      .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (errDoc) {
      mostrarNotificacion('Error al validar documento ID', 'error');
      return false;
    }
    if (docExistente) {
      mostrarNotificacion(`⚠️ El documento ID ya está registrado para ${docExistente.nombre_completo}.`, 'advertencia');
      return false;
    }

    if (nuevo.email) {
      const { data: emailExistente, error: errEmail } = await supabase
        .from('flota_perfil')
        .select('id, nombre_completo')
        .eq('email', nuevo.email.toLowerCase())
        .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (errEmail) {
        mostrarNotificacion('Error al validar email', 'error');
        return false;
      }
      if (emailExistente) {
        mostrarNotificacion(`⚠️ El email ya está registrado para ${emailExistente.nombre_completo}.`, 'advertencia');
        return false;
      }
    }

    return true;
  };

  // ------------------------------------------------------------
  // GUARDAR (CREAR O ACTUALIZAR)
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
          .from('flota_perfil')
          .update({
            nombre_completo: nuevo.nombre_completo,
            documento_id: nuevo.documento_id,
            email: nuevo.email.toLowerCase(),
            nombre_flota: nuevo.nombre_flota,
            cant_choferes: nuevo.cant_choferes,
            cant_rutas: nuevo.cant_rutas,
          })
          .eq('id', editando.id);
        if (error) throw error;

        mostrarNotificacion('Perfil actualizado correctamente.', 'exito');
      } else {
        const { data: pinGenerado, error: pinError } = await supabase.rpc('generar_pin_flota');
        if (pinError) throw new Error('Error al generar PIN: ' + pinError.message);
        if (!pinGenerado) throw new Error('No se pudo generar el PIN');

        const { data: nuevoPerfil, error } = await supabase
          .from('flota_perfil')
          .insert([
            {
              nombre_completo: nuevo.nombre_completo,
              documento_id: nuevo.documento_id,
              email: nuevo.email.toLowerCase(),
              nombre_flota: nuevo.nombre_flota,
              cant_choferes: nuevo.cant_choferes,
              cant_rutas: nuevo.cant_rutas,
              pin_secreto: pinGenerado,
              activo: true,
              fecha_creacion: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (error) throw error;

        if (nuevo.email) {
          const resultado = await enviarCorreoFlota(nuevoPerfil);
          if (resultado.success) {
            mostrarNotificacion('Perfil creado y correo enviado correctamente.', 'exito');
          } else {
            mostrarNotificacion(`Perfil creado, pero falló el envío del correo: ${resultado.error}`, 'advertencia');
          }
        } else {
          mostrarNotificacion('Perfil de flota creado correctamente.', 'exito');
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
  const handleReenviarCorreo = async (perfil: any) => {
    if (!perfil.email) {
      mostrarNotificacion('El perfil no tiene email para reenviar.', 'advertencia');
      return;
    }
    setEnviandoCorreo(perfil.id);
    const resultado = await enviarCorreoFlota(perfil);
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
  // EDITAR PERFIL
  // ------------------------------------------------------------
  const editarPerfil = (perfil: any) => {
    setEditando(perfil);
    setNuevo({
      nombre_completo: perfil.nombre_completo,
      documento_id: perfil.documento_id,
      email: perfil.email || '',
      nombre_flota: perfil.nombre_flota || '',
      cant_choferes: perfil.cant_choferes || 1,
      cant_rutas: perfil.cant_rutas || 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ------------------------------------------------------------
  // CAMBIAR ESTADO ACTIVO/INACTIVO (desde la tabla)
  // ------------------------------------------------------------
  const toggleActivo = async (perfil: any) => {
    try {
      await supabase
        .from('flota_perfil')
        .update({ activo: !perfil.activo })
        .eq('id', perfil.id);
    } catch (error: any) {
      mostrarNotificacion(`Error al cambiar estado: ${error.message}`, 'error');
    }
  };

  // ------------------------------------------------------------
  // EXPORTAR EXCEL
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const data = perfiles.map((p) => ({
      Nombre: p.nombre_completo,
      Documento: p.documento_id,
      Email: p.email,
      Flota: p.nombre_flota,
      Choferes: p.cant_choferes,
      Rutas: p.cant_rutas,
      PIN: p.pin_secreto,
      Activo: p.activo ? 'SÍ' : 'NO',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Flota');
    XLSX.writeFile(wb, `Flota_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ------------------------------------------------------------
  // FILTRAR PERFILES
  // ------------------------------------------------------------
  const perfilesFiltrados = perfiles.filter(
    (p) =>
      p.nombre_completo.toLowerCase().includes(filtro.toLowerCase()) ||
      p.documento_id?.toLowerCase().includes(filtro.toLowerCase()) ||
      p.email?.toLowerCase().includes(filtro.toLowerCase()) ||
      p.nombre_flota?.toLowerCase().includes(filtro.toLowerCase())
  );

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-black p-4 md:p-6 text-white font-sans">
      <div className="max-w-7xl mx-auto">
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
              onClick={() => router.push('/admin/flota')}
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
                <CampoEntrada
                  label="NOMBRE"
                  placeholder="Nombre completo"
                  value={nuevo.nombre_completo}
                  onChange={(e) => setNuevo({ ...nuevo, nombre_completo: e.target.value })}
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
                  className="lg:col-span-1"
                />
                <CampoEntrada
                  label="FLOTA"
                  placeholder="Empresa"
                  value={nuevo.nombre_flota}
                  onChange={(e) => setNuevo({ ...nuevo, nombre_flota: e.target.value })}
                  className="lg:col-span-1"
                />
                <SelectOpcion
                  label="CHOFERES"
                  value={nuevo.cant_choferes}
                  onChange={(val) => setNuevo({ ...nuevo, cant_choferes: val })}
                  options={Array.from({ length: 10 }, (_, i) => i + 1)}
                  className="lg:col-span-1"
                />
                <SelectOpcion
                  label="RUTAS"
                  value={nuevo.cant_rutas}
                  onChange={(val) => setNuevo({ ...nuevo, cant_rutas: val })}
                  options={Array.from({ length: 21 }, (_, i) => i)}
                  className="lg:col-span-1"
                />
                {editando && (
                  <CampoEntrada
                    label="PIN ASIGNADO"
                    value={editando.pin_secreto || ''}
                    disabled
                    textCentered
                    uppercase
                    className="border-blue-500/30 lg:col-span-1"
                  />
                )}
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
                placeholder="BUSCAR PERFIL..."
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
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Documento</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Flota</th>
                  <th className="p-4 text-center">Choferes</th>
                  <th className="p-4 text-center">Rutas</th>
                  <th className="p-4 text-center">PIN</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center" colSpan={2}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {perfilesFiltrados.map((perfil) => (
                  <tr key={perfil.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-[13px] uppercase text-white">
                        {perfil.nombre_completo}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[12px]">
                      {perfil.documento_id}
                    </td>
                    <td className="p-4 text-[11px]">
                      {perfil.email}
                    </td>
                    <td className="p-4">
                      {perfil.nombre_flota || '-'}
                    </td>
                    <td className="p-4 text-center font-black">
                      {perfil.cant_choferes}
                    </td>
                    <td className="p-4 text-center font-black">
                      {perfil.cant_rutas}
                    </td>
                    <td className="p-4 text-center">
                      <div className="group relative inline-block">
                        <span className="text-[11px] font-mono text-slate-600 group-hover:hidden tracking-widest">
                          ••••••
                        </span>
                        <span className="text-[11px] font-mono text-amber-500 hidden group-hover:block font-bold">
                          {perfil.pin_secreto}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleActivo(perfil)}
                        className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                          perfil.activo
                            ? 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10'
                            : 'text-rose-500 border-rose-500/30 hover:bg-rose-500/10'
                        }`}
                      >
                        {perfil.activo ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => editarPerfil(perfil)}
                        className="text-blue-500 hover:text-white font-black text-[10px] uppercase px-3 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all"
                      >
                        EDITAR
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleReenviarCorreo(perfil)}
                        disabled={enviandoCorreo === perfil.id}
                        className="text-emerald-500 hover:text-white font-black text-[10px] uppercase px-3 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        {enviandoCorreo === perfil.id ? '...' : '📧 REENVIAR'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {perfilesFiltrados.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-slate-500 text-[11px] uppercase tracking-widest">
                No hay perfiles que coincidan con la búsqueda.
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