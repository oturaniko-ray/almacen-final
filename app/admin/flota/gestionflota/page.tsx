'use client';
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from '@e965/xlsx';
import { getAuthHeaders } from '@/lib/apiClient';
import {
  CampoEntrada,
  SelectOpcion,
  Buscador,
  NotificacionSistema
} from '../../../components';

// ------------------------------------------------------------
// INTERFACES PARA TIPADO
// ------------------------------------------------------------
interface FlotaPerfil {
  id: string;
  nombre_completo: string;
  documento_id: string;
  email: string | null;
  telefono?: string | null;
  nombre_flota: string | null;
  cant_choferes: number;
  cant_rutas: number;
  pin_secreto: string;
  activo: boolean;
  fecha_creacion: string;
  sucursal_origen?: string;
  en_patio?: boolean;
}

interface NuevoPerfil {
  nombre_completo: string;
  documento_id: string;
  email: string;
  telefono: string;
  nombre_flota: string;
  cant_choferes: number;
  cant_rutas: number;
}

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
// MEMBRETE SUPERIOR
// ------------------------------------------------------------
const MemebreteSuperior = ({ 
  usuario, 
  onExportar, 
  onRegresar 
}: { 
  usuario?: any; 
  onExportar: () => void; 
  onRegresar: () => void;
}) => {
  const titulo = "GESTOR DE FLOTA";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="w-full mb-4">
      <div className="w-full bg-gradient-to-r from-[#1a1a1a] to-[#0f172a] px-6 py-4 rounded-[25px] border border-blue-500/20 shadow-2xl flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-black italic uppercase tracking-tighter">
            <span className="text-white">{primerasPalabras} </span>
            <span className="text-blue-500">{ultimaPalabra}</span>
          </h1>
          {usuario && (
            <div className="text-sm mt-1">
              <span className="text-white/80">{usuario.nombre}</span>
              <span className="text-white/50 mx-1">•</span>
              <span className="text-blue-400">{formatearRol(usuario.rol)}</span>
              <span className="text-white/50 ml-1">(Nivel {usuario.nivel_acceso})</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onExportar}
            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider border border-emerald-500/30 hover:border-emerald-500 transition-all active:scale-95"
          >
            EXPORTAR
          </button>
          <button
            onClick={onRegresar}
            className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider border border-blue-500/30 hover:border-blue-500 transition-all active:scale-95"
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
export default function GestionFlota() {
  const [user, setUser] = useState<any>(null);
  const [perfiles, setPerfiles] = useState<FlotaPerfil[]>([]);
  const [editando, setEditando] = useState<FlotaPerfil | null>(null);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState<string | null>(null);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState<string | null>(null);
  const [enviandoTelegram, setEnviandoTelegram] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  const [modalConfirmacion, setModalConfirmacion] = useState<{ isOpen: boolean; perfil: FlotaPerfil | null }>({ isOpen: false, perfil: null });
  const router = useRouter();
  const [sucursalDetectada, setSucursalDetectada] = useState<string>('01');

  const estadoInicial: NuevoPerfil = {
    nombre_completo: '',
    documento_id: '',
    email: '',
    telefono: '',
    nombre_flota: '',
    cant_choferes: 1,
    cant_rutas: 0,
  };
  const [nuevo, setNuevo] = useState<NuevoPerfil>(estadoInicial);

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
    if (data) setPerfiles(data as FlotaPerfil[]);
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

    // Detectar sucursal por GPS para asignar PIN correcto
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 8000, maximumAge: 60000
          })
        );
        const { latitude: lat, longitude: lon } = pos.coords;
        const res = await fetch(`/api/sucursales/detectar?lat=${lat}&lon=${lon}`);
        const json = await res.json();
        if (json.deteccion) {
          setSucursalDetectada(json.deteccion.codigo);
        }
      } catch {
        // Si GPS falla, queda '01' por defecto
      }
    })();

    const channel = supabase
      .channel('flota_perfil_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flota_perfil' }, fetchPerfiles)
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [fetchPerfiles, router]);

  // ------------------------------------------------------------
  // VALIDACIONES DE DUPLICADOS
  // ------------------------------------------------------------
  const validarDuplicados = async (): Promise<boolean> => {
    const { data: docExistente } = await supabase
      .from('flota_perfil')
      .select('id, nombre_completo')
      .eq('documento_id', nuevo.documento_id)
      .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (docExistente) {
      mostrarNotificacion(`El documento ID ya está registrado para ${docExistente.nombre_completo}.`, 'advertencia');
      return false;
    }

    if (nuevo.email) {
      const { data: emailExistente } = await supabase
        .from('flota_perfil')
        .select('id, nombre_completo')
        .eq('email', nuevo.email.toLowerCase())
        .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (emailExistente) {
        mostrarNotificacion(`El email ya está registrado para ${emailExistente.nombre_completo}.`, 'advertencia');
        return false;
      }
    }

    return true;
  };

  // --- FUNCIÓN: enviar correo ---
  const enviarCorreoFlota = async (perfil: FlotaPerfil, to?: string) => {
    setEnviandoCorreo(perfil.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tipo: 'flota',
          datos: {
            flotaId: perfil.id,
            nombre_completo: perfil.nombre_completo,
            documento_id: perfil.documento_id,
            email: perfil.email,
            nombre_flota: perfil.nombre_flota,
            cant_choferes: perfil.cant_choferes,
            cant_rutas: perfil.cant_rutas,
            pin_secreto: perfil.pin_secreto,
          },
          to: to || perfil.email,
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

  // --- FUNCIÓN: enviar Telegram ---
  const handleEnviarTelegram = async (perfil: FlotaPerfil) => {
    if (!perfil.telefono) {
      mostrarNotificacion('El perfil no tiene teléfono registrado', 'advertencia');
      return;
    }

    setEnviandoTelegram(perfil.id);

    try {
      const { data: telegramUser } = await supabase
        .from('telegram_usuarios')
        .select('chat_id')
        .eq('empleado_id', perfil.id)
        .maybeSingle();

      if (!telegramUser) {
        mostrarNotificacion(
          'El perfil no ha iniciado conversación con el bot',
          'error'
        );
        setEnviandoTelegram(null);
        return;
      }

      const mensaje = `Perfil de Flota Registrado\n\nHola ${perfil.nombre_completo},\nTu PIN de acceso es: ${perfil.pin_secreto}\n\nMás información: https://almacen-final.vercel.app/`;

      const response = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          chat_id: telegramUser.chat_id,
          text: mensaje
        }),
      });

      const resultado = await response.json();

      if (resultado.success) {
        mostrarNotificacion('Telegram enviado correctamente', 'exito');
      } else {
        mostrarNotificacion(`Error Telegram: ${resultado.error}`, 'error');
      }
    } catch (error: any) {
      console.error('Error en Telegram:', error);
      mostrarNotificacion(`Error: ${error.message}`, 'error');
    } finally {
      setEnviandoTelegram(null);
    }
  };

  // --- FUNCIÓN: cambiar estado activo/inactivo ---
  const toggleActivo = async (perfil: FlotaPerfil) => {
    try {
      const { error } = await supabase
        .from('flota_perfil')
        .update({ activo: !perfil.activo })
        .eq('id', perfil.id);

      if (error) throw error;

      mostrarNotificacion(
        perfil.activo ? 'Perfil desactivado' : 'Perfil activado',
        'exito'
      );
      fetchPerfiles();
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
          nombre_completo: nuevo.nombre_completo,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          telefono: nuevo.telefono,
          nombre_flota: nuevo.nombre_flota,
          cant_choferes: nuevo.cant_choferes,
          cant_rutas: nuevo.cant_rutas,
        };

        const { error } = await supabase
          .from('flota_perfil')
          .update(updateData)
          .eq('id', editando.id);

        if (error) throw error;
        mostrarNotificacion('Perfil actualizado correctamente.', 'exito');
        cancelarEdicion();
        fetchPerfiles();
      } else {
        const { data: pinGenerado, error: pinError } = await supabase
          .rpc('generar_pin_flota_sucursal', { p_sucursal_codigo: sucursalDetectada });

        if (pinError) throw new Error('Error al generar PIN: ' + pinError.message);
        if (!pinGenerado) throw new Error('No se pudo generar el PIN');

        const insertData = {
          nombre_completo: nuevo.nombre_completo,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          telefono: nuevo.telefono || null,
          nombre_flota: nuevo.nombre_flota,
          cant_choferes: nuevo.cant_choferes,
          cant_rutas: nuevo.cant_rutas,
          pin_secreto: pinGenerado,
          activo: true,
          fecha_creacion: new Date().toISOString(),
          sucursal_origen: sucursalDetectada,
        };

        const { data: nuevoPerfil, error } = await supabase
          .from('flota_perfil')
          .insert([insertData])
          .select()
          .single();

        if (error) throw error;

        if (nuevo.email && nuevoPerfil) {
          setModalConfirmacion({
            isOpen: true,
            perfil: nuevoPerfil as FlotaPerfil
          });
        } else {
          mostrarNotificacion('Perfil de flota creado correctamente.', 'exito');
        }
        cancelarEdicion();
        fetchPerfiles();
      }
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
  const handleReenviarCorreo = (perfil: FlotaPerfil) => {
    if (!perfil.email) {
      mostrarNotificacion('El perfil no tiene email para reenviar.', 'advertencia');
      return;
    }
    setModalConfirmacion({
      isOpen: true,
      perfil: perfil
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
  // EDITAR PERFIL
  // ------------------------------------------------------------
  const editarPerfil = (perfil: FlotaPerfil) => {
    setEditando(perfil);
    setNuevo({
      nombre_completo: perfil.nombre_completo,
      documento_id: perfil.documento_id,
      email: perfil.email || '',
      telefono: perfil.telefono || '',
      nombre_flota: perfil.nombre_flota || '',
      cant_choferes: perfil.cant_choferes || 1,
      cant_rutas: perfil.cant_rutas || 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ------------------------------------------------------------
  // EXPORTAR EXCEL
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = perfiles.map((p) => ({
      Nombre: p.nombre_completo,
      Documento: p.documento_id,
      Email: p.email || '',
      Telefono: p.telefono || '',
      Flota: p.nombre_flota || '',
      Choferes: p.cant_choferes,
      Rutas: p.cant_rutas,
      PIN: p.pin_secreto,
      Activo: p.activo ? 'SI' : 'NO',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const columnWidths = [
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
      { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
    ];
    ws['!cols'] = columnWidths;

    const fechaEmision = new Date().toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const titulo = `GESTOR DE FLOTA`;
    const empleadoInfo = user ? `${user.nombre} - ${formatearRol(user.rol)} (Nivel ${user.nivel_acceso})` : 'Sistema';
    const fechaInfo = `Fecha de emision: ${fechaEmision}`;

    XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(ws, [[empleadoInfo]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(ws, [[fechaInfo]], { origin: 'A3' });
    XLSX.utils.sheet_add_aoa(ws, [['─────────────────────────────────────────────────────────────────']], { origin: 'A4' });

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const newData = XLSX.utils.sheet_to_json(ws, { header: 1, range: 5 });
    if (newData.length > 0) {
      XLSX.utils.sheet_add_aoa(ws, newData as any[][], { origin: 'A6' });
    }

    XLSX.utils.book_append_sheet(wb, ws, "Flota");
    const timestamp = getTimestamp();
    const filename = `flota_${timestamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    mostrarNotificacion('ARCHIVO EXPORTADO', 'exito');
  };

  // ------------------------------------------------------------
  // REGRESAR
  // ------------------------------------------------------------
  const handleRegresar = () => {
    router.push('/admin/flota');
  };

  // ------------------------------------------------------------
  // FILTRAR PERFILES
  // ------------------------------------------------------------
  const perfilesFiltrados = perfiles.filter(
    (p) =>
      p.nombre_completo.toLowerCase().includes(filtro.toLowerCase()) ||
      p.documento_id?.toLowerCase().includes(filtro.toLowerCase()) ||
      p.email?.toLowerCase().includes(filtro.toLowerCase()) ||
      (p.telefono && p.telefono.includes(filtro)) ||
      p.nombre_flota?.toLowerCase().includes(filtro.toLowerCase())
  );

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-[#050a14] p-3 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <NotificacionSistema
          mensaje={notificacion.mensaje}
          tipo={notificacion.tipo}
          visible={!!notificacion.tipo}
          duracion={2000}
          onCerrar={() => setNotificacion({ mensaje: '', tipo: null })}
        />

        <MemebreteSuperior
          usuario={user}
          onExportar={exportarExcel}
          onRegresar={handleRegresar}
        />

        <div className={`bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] p-4 rounded-xl border transition-all mb-3 ${editando ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-blue-500/20'}`}>
          <form onSubmit={handleGuardar}>
            <div className="grid grid-cols-1 md:grid-cols-9 gap-3">
              <div className="md:col-span-1">
                <CampoEntrada
                  label="NOMBRE"
                  placeholder="Nombre completo"
                  valor={nuevo.nombre_completo}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, nombre_completo: e.target.value })}
                  required
                  autoFocus
                  className="bg-black/30 border-white/10 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-1">
                <CampoEntrada
                  label="DOCUMENTO"
                  placeholder="DNI / RUC"
                  valor={nuevo.documento_id}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, documento_id: e.target.value })}
                  required
                  mayusculas
                  className="bg-black/30 border-white/10 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-1">
                <CampoEntrada
                  label="EMAIL"
                  placeholder="correo@empresa.com"
                  tipo="email"
                  valor={nuevo.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, email: e.target.value })}
                  className="bg-black/30 border-white/10 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-1">
                <CampoEntrada
                  label="TELEFONO"
                  placeholder="+34 600 000 000"
                  valor={nuevo.telefono}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, telefono: e.target.value })}
                  className="bg-black/30 border-white/10 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-1">
                <CampoEntrada
                  label="FLOTA"
                  placeholder="Nombre de la flota"
                  valor={nuevo.nombre_flota}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, nombre_flota: e.target.value })}
                  className="bg-black/30 border-white/10 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-1">
                <CampoEntrada
                  label="CHOFERES"
                  placeholder="0"
                  tipo="number"
                  valor={nuevo.cant_choferes.toString()}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, cant_choferes: parseInt(e.target.value) || 0 })}
                  required
                  className="bg-black/30 border-white/10 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-1">
                <CampoEntrada
                  label="RUTAS"
                  placeholder="0"
                  tipo="number"
                  valor={nuevo.cant_rutas.toString()}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, cant_rutas: parseInt(e.target.value) || 0 })}
                  required
                  className="bg-black/30 border-white/10 focus:border-blue-500"
                />
              </div>

              {editando && (
                <div className="md:col-span-1">
                  <CampoEntrada
                    label="PIN"
                    valor={editando.pin_secreto || ''}
                    onChange={() => {}}
                    disabled
                    mayusculas
                    className="bg-blue-500/10 border-blue-500/30 text-blue-400"
                  />
                </div>
              )}

              <div className="md:col-span-1 flex flex-col items-stretch justify-center gap-2">
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white font-black text-xs uppercase py-2.5 rounded-lg border border-rose-500/30 hover:border-rose-500 transition-all"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-black text-xs uppercase py-2.5 rounded-lg border border-emerald-500/30 hover:border-emerald-500 transition-all disabled:opacity-50"
                >
                  {loading ? '...' : 'ACEPTAR'}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="mb-3">
          <Buscador
            placeholder="BUSCAR PERFIL POR NOMBRE, DOCUMENTO, EMAIL O FLOTA"
            value={filtro}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFiltro(e.target.value)}
            onClear={() => setFiltro('')}
            className="bg-[#0f172a] border-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] rounded-xl border border-blue-500/20 overflow-hidden max-h-[60vh] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ minWidth: '1200px' }}>
              <thead className="bg-black/40 text-[11px] font-black text-blue-400 uppercase tracking-wider sticky top-0 z-30 border-b border-blue-500/20">
                <tr>
                  <th className="p-3 w-[18%]">NOMBRE / DOC</th>
                  <th className="p-3 w-[22%]">EMAIL / TELEFONO</th>
                  <th className="p-3 w-[14%]">FLOTA</th>
                  <th className="p-3 text-center w-[5%]">CHOF</th>
                  <th className="p-3 text-center w-[5%]">RUT</th>
                  <th className="p-3 text-center w-[9%]">PIN</th>
                  <th className="p-3 text-center w-[6%]">EST</th>
                  <th className="p-3 text-center w-[8%]">EDITAR</th>
                  <th className="p-3 text-center w-[13%]">NOTIFICACIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/10">
                {perfilesFiltrados.map((perfil) => (
                  <tr key={perfil.id} className="hover:bg-blue-500/5 transition-colors group">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            perfil.en_patio ? 'bg-amber-500 shadow-[0_0_12px_#f59e0b] animate-pulse' : 'bg-slate-600'
                          }`}
                          title={perfil.en_patio ? 'En Patio' : 'Fuera del almacén'}
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-sm uppercase text-white group-hover:text-blue-400 transition-colors truncate" title={perfil.nombre_completo}>
                            {perfil.nombre_completo}
                          </span>
                          <span className="text-slate-500 text-[10px] font-mono truncate">{perfil.documento_id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-300 text-xs truncate" title={perfil.email || ''}>
                          {perfil.email || '-'}
                        </span>
                        {perfil.telefono && (
                          <span className="text-emerald-400 text-xs truncate">
                            {perfil.telefono}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 text-xs truncate text-white/80">{perfil.nombre_flota || '-'}</td>
                    <td className="p-3 text-center font-black text-xs">{perfil.cant_choferes}</td>
                    <td className="p-3 text-center font-black text-xs">{perfil.cant_rutas}</td>

                    <td className="p-3 text-center">
                      <div className="group relative inline-block">
                        <span className="text-xs font-mono text-slate-600 group-hover:hidden tracking-widest">••••••</span>
                        <span className="text-xs font-mono text-amber-500 hidden group-hover:block font-bold">{perfil.pin_secreto}</span>
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleActivo(perfil)}
                        className={`px-3 py-1.5 rounded-full text-[9px] font-black transition-all cursor-pointer hover:scale-105 ${
                          perfil.activo
                            ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30'
                            : 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/30'
                        }`}
                        title={perfil.activo ? 'Activo (haz clic para desactivar)' : 'Inactivo (haz clic para activar)'}
                      >
                        {perfil.activo ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => editarPerfil(perfil)}
                        className="text-blue-400 hover:text-white font-black text-[10px] uppercase px-4 py-2 rounded-lg border border-blue-500/30 hover:bg-blue-600 transition-all group-hover:border-blue-500"
                      >
                        EDITAR
                      </button>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex gap-2 items-center justify-center">
                        <button
                          onClick={() => handleReenviarCorreo(perfil)}
                          disabled={enviandoCorreo === perfil.id}
                          title="Enviar correo de bienvenida"
                          className="flex items-center gap-1 text-emerald-400 hover:text-white font-black text-[9px] uppercase px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-600 transition-all disabled:opacity-50"
                        >
                          {enviandoCorreo === perfil.id ? '...' : 'EMAIL'}
                        </button>
                        <button
                          onClick={() => router.push('/admin/mensajeria')}
                          title="Ir al módulo de mensajería Telegram"
                          className="flex items-center gap-1 text-blue-400 hover:text-white font-black text-[9px] uppercase px-3 py-1.5 rounded-lg border border-blue-500/30 hover:bg-blue-600 transition-all"
                        >
                          TG
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {perfilesFiltrados.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-500 text-xs uppercase tracking-widest">No hay perfiles que coincidan con la búsqueda.</p>
            </div>
          )}
        </div>
      </div>

      <ModalConfirmacion
        isOpen={modalConfirmacion.isOpen}
        onClose={() => setModalConfirmacion({ isOpen: false, perfil: null })}
        onConfirm={() => {
          if (modalConfirmacion.perfil) {
            enviarCorreoFlota(modalConfirmacion.perfil);
          }
        }}
        mensaje="¿Deseas enviar un correo con las credenciales de acceso?"
        email={modalConfirmacion.perfil?.email || null}
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