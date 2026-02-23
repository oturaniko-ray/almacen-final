'use client';
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  CampoEntrada,
  SelectOpcion,
  BotonIcono,
  Buscador,
  BadgeEstado,
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
const MemebreteSuperior = ({ usuario, onExportar, onRegresar }: { usuario?: any; onExportar: () => void; onRegresar: () => void }) => {
  const titulo = "GESTOR DE FLOTA";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="relative w-full mb-4">
      <div className="w-full max-w-sm bg-[#1a1a1a] p-5 rounded-[25px] border border-white/5 text-center shadow-2xl mx-auto">
        <h1 className="text-xl font-black italic uppercase tracking-tighter">
          <span className="text-white">{primerasPalabras} </span>
          <span className="text-blue-700">{ultimaPalabra}</span>
        </h1>
        {usuario && (
          <div className="mt-1 text-sm">
            <span className="text-white">{usuario.nombre}</span>
            <span className="text-white mx-1">•</span>
            <span className="text-blue-500">{formatearRol(usuario.rol)}</span>
            <span className="text-white ml-1">({usuario.nivel_acceso})</span>
          </div>
        )}
      </div>
      <div className="absolute top-0 right-0 flex gap-2 mt-4 mr-4">
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

    const channel = supabase
      .channel('flota_perfil_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flota_perfil' }, fetchPerfiles)
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(error => {
        console.error('Error removing channel:', error);
      });
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

    if (errDoc) { mostrarNotificacion('Error al validar documento ID', 'error'); return false; }

    if (docExistente && typeof docExistente === 'object' && 'nombre_completo' in docExistente) {
      mostrarNotificacion(`⚠️ El documento ID ya está registrado para ${(docExistente as { nombre_completo: string }).nombre_completo}.`, 'advertencia');
      return false;
    }

    if (nuevo.email) {
      const { data: emailExistente, error: errEmail } = await supabase
        .from('flota_perfil')
        .select('id, nombre_completo')
        .eq('email', nuevo.email.toLowerCase())
        .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (errEmail) { mostrarNotificacion('Error al validar email', 'error'); return false; }

      if (emailExistente && typeof emailExistente === 'object' && 'nombre_completo' in emailExistente) {
        mostrarNotificacion(`⚠️ El email ya está registrado para ${(emailExistente as { nombre_completo: string }).nombre_completo}.`, 'advertencia');
        return false;
      }
    }

    return true;
  };

  // --- FUNCIÓN: enviar correo de flota usando fetch a la API ---
  const enviarCorreoFlota = async (perfil: FlotaPerfil, to?: string) => {
    setEnviandoCorreo(perfil.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'flota',
          datos: {
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

  // --- FUNCIÓN: enviar WhatsApp ---
  const handleEnviarWhatsApp = async (perfil: FlotaPerfil) => {
    if (!perfil.telefono) {
      mostrarNotificacion('El perfil no tiene teléfono registrado', 'advertencia');
      return;
    }

    setEnviandoWhatsApp(perfil.id);
    
    const mensaje = `Hola ${perfil.nombre_completo}, tu perfil de flota ha sido registrado.
Tu PIN de acceso es: ${perfil.pin_secreto}.
Cuando llegues al almacén, un supervisor registrará tu ingreso.
Más información en: https://almacen-final.vercel.app/`;

    try {
      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: perfil.telefono, 
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

  // --- FUNCIÓN: enviar Telegram ---
  const handleEnviarTelegram = async (perfil: FlotaPerfil) => {
    if (!perfil.telefono) {
      mostrarNotificacion('El perfil no tiene teléfono registrado', 'advertencia');
      return;
    }

    setEnviandoTelegram(perfil.id);
    
    const mensaje = `🚛 *Perfil de Flota Registrado*

Hola *${perfil.nombre_completo}*,
Tu PIN de acceso es: *${perfil.pin_secreto}*

Cuando llegues al almacén, un supervisor registrará tu ingreso.
Más información: [almacen-final.vercel.app](https://almacen-final.vercel.app/)`;

    try {
      const response = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: perfil.telefono, 
          message: mensaje 
        }),
      });
      const resultado = await response.json();
      
      if (resultado.success) {
        mostrarNotificacion('Telegram enviado correctamente', 'exito');
      } else {
        mostrarNotificacion(`Error Telegram: ${resultado.error}`, 'error');
      }
    } catch (error: any) {
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
        .update({ activo: !perfil.activo } as never)
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
          .update(updateData as never)
          .eq('id', editando.id);

        if (error) throw error;
        mostrarNotificacion('Perfil actualizado correctamente.', 'exito');
      } else {
        const { data: pinGenerado, error: pinError } = await supabase.rpc('generar_pin_flota');
        if (pinError) throw new Error('Error al generar PIN: ' + pinError.message);
        if (!pinGenerado) throw new Error('No se pudo generar el PIN');

        const insertData = [{
          nombre_completo: nuevo.nombre_completo,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          telefono: nuevo.telefono,
          nombre_flota: nuevo.nombre_flota,
          cant_choferes: nuevo.cant_choferes,
          cant_rutas: nuevo.cant_rutas,
          pin_secreto: pinGenerado,
          activo: true,
          fecha_creacion: new Date().toISOString(),
        }];

        const { data: nuevoPerfil, error } = await supabase
          .from('flota_perfil')
          .insert(insertData as never)
          .select()
          .single();

        if (error) throw error;

        if (nuevo.email) {
          setModalConfirmacion({
            isOpen: true,
            perfil: nuevoPerfil as FlotaPerfil
          });
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
  // FUNCIÓN PARA REENVIAR CORREO (CON MODAL)
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
  // EXPORTAR EXCEL - UNIFICADO
  // ------------------------------------------------------------
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = perfiles.map((p) => ({
      Nombre: p.nombre_completo,
      Documento: p.documento_id,
      Email: p.email,
      Teléfono: p.telefono || '',
      Flota: p.nombre_flota,
      Choferes: p.cant_choferes,
      Rutas: p.cant_rutas,
      PIN: p.pin_secreto,
      Activo: p.activo ? 'SÍ' : 'NO',
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

    XLSX.utils.book_append_sheet(wb, ws, "Flota");
    const timestamp = getTimestamp();
    const filename = `flota_${timestamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    mostrarNotificacion('✅ ARCHIVO EXPORTADO', 'exito');
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

        {/* HEADER */}
        <MemebreteSuperior
          usuario={user}
          onExportar={exportarExcel}
          onRegresar={handleRegresar}
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
                  valor={nuevo.nombre_completo}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, nombre_completo: e.target.value })}
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
              
              {/* Col 5: FLOTA */}
              <div className="col-span-1">
                <CampoEntrada
                  label="FLOTA"
                  placeholder="Empresa"
                  valor={nuevo.nombre_flota}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, nombre_flota: e.target.value })}
                />
              </div>
              
              {/* Col 6: CHOFERES */}
              <div className="col-span-1">
                <div className="flex flex-col">
                  <label className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-wider">
                    CHOFERES
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={nuevo.cant_choferes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, cant_choferes: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-white font-black text-lg outline-none focus:border-blue-500/50 transition-all text-center"
                  />
                </div>
              </div>
              
              {/* Col 7: RUTAS */}
              <div className="col-span-1">
                <div className="flex flex-col">
                  <label className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-wider">
                    RUTAS
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={nuevo.cant_rutas}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, cant_rutas: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-white font-black text-lg outline-none focus:border-blue-500/50 transition-all text-center"
                  />
                </div>
              </div>
              
              {/* Col 8: PIN (solo edición) */}
              {editando && (
                <div className="col-span-1">
                  <CampoEntrada
                    label="PIN"
                    valor={editando.pin_secreto || ''}
                    onChange={() => {}}
                    disabled
                    mayusculas
                    className="border-blue-500/30"
                  />
                </div>
              )}
              
              {/* Col 9: BOTONES */}
              <div className="col-span-1 flex items-end gap-1 justify-end">
                <BotonIcono icono="🚫" onClick={cancelarEdicion} color="bg-rose-600" type="button" />
                <BotonIcono icono="✅" onClick={() => {}} color="bg-emerald-600" type="submit" disabled={loading} />
              </div>
            </div>
          </form>
        </div>

        {/* BUSCADOR */}
        <div className="mb-3">
          <Buscador
            placeholder="BUSCAR PERFIL..."
            value={filtro}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFiltro(e.target.value)}
            onClear={() => setFiltro('')}
          />
        </div>

        {/* TABLA - Con botones de WhatsApp y Telegram */}
        <div className="bg-[#0f172a] rounded-xl border border-white/5 overflow-hidden max-h-[60vh] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ minWidth: '1200px' }}>
              <thead className="bg-[#0f172a] text-[9px] font-black text-slate-400 uppercase tracking-wider sticky top-0 z-30 border-b border-white/10">
                <tr>
                  <th className="p-3 w-[15%]">NOMBRE</th>
                  <th className="p-3 w-[10%]">DOCUMENTO</th>
                  <th className="p-3 w-[15%]">EMAIL / TEL</th>
                  <th className="p-3 w-[10%]">FLOTA</th>
                  <th className="p-3 text-center w-[6%]">CHOF</th>
                  <th className="p-3 text-center w-[6%]">RUT</th>
                  <th className="p-3 text-center w-[8%]">PIN</th>
                  <th className="p-3 text-center w-[6%]">EST</th>
                  <th className="p-3 text-center w-[24%]" colSpan={4}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {perfilesFiltrados.map((perfil) => (
                  <tr key={perfil.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {/* PUNTO VERDE - SOLO VISUAL (no clicable) */}
                        <div 
                          className={`w-3 h-3 rounded-full ${perfil.activo ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`}
                          title={perfil.activo ? 'Activo' : 'Inactivo'}
                        />
                        <span className="font-bold text-sm uppercase text-white truncate" title={perfil.nombre_completo}>
                          {perfil.nombre_completo.length > 20 
                            ? perfil.nombre_completo.substring(0, 18) + '...' 
                            : perfil.nombre_completo}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] truncate">{perfil.documento_id}</td>
                    <td className="p-3">
                      <div className="text-[11px] font-mono">
                        <span className="block text-slate-500 text-[9px] truncate" title={perfil.email || ''}>
                          {perfil.email || '-'}
                        </span>
                        {perfil.telefono && (
                          <span className="text-emerald-500 text-[9px] block truncate">
                            📱 {perfil.telefono}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[11px] truncate">{perfil.nombre_flota || '-'}</td>
                    <td className="p-3 text-center font-black text-[11px]">{perfil.cant_choferes}</td>
                    <td className="p-3 text-center font-black text-[11px]">{perfil.cant_rutas}</td>
                    <td className="p-3 text-center">
                      <div className="group relative inline-block">
                        <span className="text-[10px] font-mono text-slate-600 group-hover:hidden tracking-widest">••••••</span>
                        <span className="text-[10px] font-mono text-amber-500 hidden group-hover:block font-bold">{perfil.pin_secreto}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {/* BOTÓN DE ACTIVO/INACTIVO - CLICABLE */}
                      <button
                        onClick={() => toggleActivo(perfil)}
                        className={`px-2 py-1 rounded-full text-[9px] font-black transition-all cursor-pointer hover:scale-105 ${
                          perfil.activo 
                            ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30' 
                            : 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30'
                        }`}
                        title={perfil.activo ? 'Activo (haz clic para desactivar)' : 'Inactivo (haz clic para activar)'}
                      >
                        {perfil.activo ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => editarPerfil(perfil)}
                        className="text-blue-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all min-w-[60px]"
                      >
                        EDITAR
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleReenviarCorreo(perfil)}
                        disabled={enviandoCorreo === perfil.id}
                        className="text-emerald-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center gap-1 mx-auto min-w-[60px]"
                      >
                        {enviandoCorreo === perfil.id ? (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-150" />
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-300" />
                          </span>
                        ) : (
                          <>
                            <span>📧</span>
                            <span className="text-[8px]">EMAIL</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleEnviarWhatsApp(perfil)}
                        disabled={enviandoWhatsApp === perfil.id || !perfil.telefono}
                        className={`text-green-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border transition-all disabled:opacity-50 flex items-center gap-1 mx-auto min-w-[60px] ${
                          perfil.telefono 
                            ? 'border-green-500/20 hover:bg-green-600' 
                            : 'border-gray-500/20 text-gray-500 cursor-not-allowed'
                        }`}
                        title="WhatsApp"
                      >
                        <span className="text-[12px]">📱</span>
                        <span className="text-[8px]">WA</span>
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleEnviarTelegram(perfil)}
                        disabled={enviandoTelegram === perfil.id || !perfil.telefono}
                        className={`text-blue-400 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border transition-all disabled:opacity-50 flex items-center gap-1 mx-auto min-w-[60px] ${
                          perfil.telefono 
                            ? 'border-blue-400/20 hover:bg-blue-500' 
                            : 'border-gray-500/20 text-gray-500 cursor-not-allowed'
                        }`}
                        title="Telegram"
                      >
                        <span className="text-[12px]">✈️</span>
                        <span className="text-[8px]">TG</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {perfilesFiltrados.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">No hay perfiles que coincidan con la búsqueda.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmación para envío de correo */}
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