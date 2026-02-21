'use client';

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/auth/context';
import { supabase } from '@/lib/supabaseClient';
import { getEmpleados, createEmpleado, updateEmpleado } from '@/lib/database/queries';
import * as XLSX from 'xlsx';
import {
  CampoEntrada,
  SelectOpcion,
  BotonIcono,
  Buscador,
  BadgeEstado,
  NotificacionSistema
} from '../../components';

// ------------------------------------------------------------
// TIPOS
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
// MODAL DE CONFIRMACIÓN
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
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function GestionEmpleados() {
  const user = useUser();
  const router = useRouter();
  
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [editando, setEditando] = useState<any>(null);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState<string | null>(null);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' | 'advertencia' | null }>({ mensaje: '', tipo: null });
  const [modalConfirmacion, setModalConfirmacion] = useState<{ isOpen: boolean; empleado: any | null }>({ isOpen: false, empleado: null });

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

  // ------------------------------------------------------------
  // CARGAR EMPLEADOS
  // ------------------------------------------------------------
  const fetchEmpleados = useCallback(async () => {
    try {
      const data = await getEmpleados(user);
      setEmpleados(data);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      mostrarNotificacion('Error al cargar empleados', 'error');
    }
  }, [user]);

  useEffect(() => {
    fetchEmpleados();
  }, [fetchEmpleados]);

  // ------------------------------------------------------------
  // VALIDACIONES
  // ------------------------------------------------------------
  const validarDuplicados = async (): Promise<boolean> => {
    let queryDoc = supabase
      .from('empleados')
      .select('id, nombre')
      .eq('documento_id', nuevo.documento_id)
      .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000');

    let queryEmail = supabase
      .from('empleados')
      .select('id, nombre')
      .eq('email', nuevo.email.toLowerCase())
      .neq('id', editando?.id || '00000000-0000-0000-0000-000000000000');

    if (user.provinciaId) {
      queryDoc = queryDoc.eq('provincia_id', user.provinciaId);
      queryEmail = queryEmail.eq('provincia_id', user.provinciaId);
    }

    const [{ data: docExistente, error: errDoc }, { data: emailExistente, error: errEmail }] = await Promise.all([
      queryDoc.maybeSingle(),
      queryEmail.maybeSingle()
    ]);

    if (errDoc) {
      mostrarNotificacion('Error al validar documento ID', 'error');
      return false;
    }

    if (docExistente) {
      const existente = docExistente as { id: string; nombre: string };
      const mensaje = user.provinciaId 
        ? `⚠️ El documento ID ya está registrado para ${existente.nombre} en esta provincia.`
        : `⚠️ El documento ID ya está registrado para ${existente.nombre}.`;
      mostrarNotificacion(mensaje, 'advertencia');
      return false;
    }

    if (errEmail) {
      mostrarNotificacion('Error al validar email', 'error');
      return false;
    }

    if (emailExistente) {
      const existente = emailExistente as { id: string; nombre: string };
      const mensaje = user.provinciaId
        ? `⚠️ El email ya está registrado para ${existente.nombre} en esta provincia.`
        : `⚠️ El email ya está registrado para ${existente.nombre}.`;
      mostrarNotificacion(mensaje, 'advertencia');
      return false;
    }

    return true;
  };

  // ------------------------------------------------------------
  // ENVÍO DE CORREO
  // ------------------------------------------------------------
  const enviarCorreoEmpleado = async (empleado: any, to?: string) => {
    setEnviandoCorreo(empleado.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // ------------------------------------------------------------
  // ENVÍO DE WHATSAPP
  // ------------------------------------------------------------
  const handleEnviarWhatsApp = async (empleado: any) => {
    if (!empleado.telefono) {
      mostrarNotificacion('El empleado no tiene teléfono', 'advertencia');
      return;
    }

    setEnviandoWhatsApp(empleado.id);
    
    try {
      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: empleado.telefono,
          nombre: empleado.nombre,
          pin: empleado.pin_seguridad,
          documento_id: empleado.documento_id
        }),
      });
      
      const resultado = await response.json();
      
      setEnviandoWhatsApp(null);
      
      if (resultado.success) {
        mostrarNotificacion('✅ WhatsApp enviado correctamente', 'exito');
      } 
      else if (resultado.error === 'CONTACTO_NUEVO' || (response.status === 404 && resultado.error?.includes('no interaction'))) {
        if (empleado.email) {
          const enviarPorCorreo = window.confirm(
            '⚠️ Este contacto es nuevo en WhatsApp y requiere una plantilla aprobada.\n\n' +
            '¿Deseas enviar las credenciales por correo electrónico?'
          );
          
          if (enviarPorCorreo) {
            await enviarCorreoEmpleado(empleado);
          }
        } else {
          mostrarNotificacion('⚠️ Contacto nuevo sin email. Espera la aprobación de la plantilla', 'advertencia');
        }
      }
      else {
        mostrarNotificacion(`❌ Error WhatsApp: ${resultado.error}`, 'error');
      }
    } catch (error: any) {
      setEnviandoWhatsApp(null);
      mostrarNotificacion(`❌ Error: ${error.message}`, 'error');
    }
  };

  // ------------------------------------------------------------
  // SINCRONIZAR CON RESPOND.IO
  // ------------------------------------------------------------
  const sincronizarConRespondIO = async (empleado: any) => {
    if (!empleado.telefono) {
      mostrarNotificacion('El empleado no tiene teléfono', 'advertencia');
      return;
    }

    try {
      const response = await fetch('/api/sync-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: empleado.telefono,
          nombre: empleado.nombre,
          email: empleado.email,
          documento_id: empleado.documento_id,
          empleado_id: empleado.id
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        mostrarNotificacion(`✅ Sincronizado con ID: ${data.respondio_contact_id}`, 'exito');
        fetchEmpleados();
      } else {
        mostrarNotificacion(`❌ Error: ${data.error}`, 'error');
      }
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
        // ACTUALIZAR
        const updateData: EmpleadoUpdate = {
          nombre: nuevo.nombre,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          telefono: nuevo.telefono,
          rol: nuevo.rol,
          activo: nuevo.activo,
          permiso_reportes: nuevo.permiso_reportes,
          nivel_acceso: nuevo.nivel_acceso,
        };

        const empleadoActualizado = await updateEmpleado(editando.id, updateData, user);
        
        if (nuevo.telefono) {
          fetch('/api/sync-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: nuevo.telefono,
              nombre: nuevo.nombre,
              email: nuevo.email,
              documento_id: nuevo.documento_id,
              empleado_id: editando.id
            }),
          }).catch(err => console.error('Error en sync:', err));
        }
        
        mostrarNotificacion('Empleado actualizado correctamente.', 'exito');
        cancelarEdicion();
      } else {
        // CREAR NUEVO
        const { data: pinGenerado, error: pinError } = await supabase.rpc('generar_pin_personal');
        
        if (pinError) {
          throw new Error('Error al generar PIN');
        }

        const insertData: EmpleadoInsert = {
          nombre: nuevo.nombre,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          telefono: nuevo.telefono,
          pin_seguridad: pinGenerado || '', // ✅ CORREGIDO: asegurar que sea string
          rol: nuevo.rol,
          activo: nuevo.activo,
          permiso_reportes: nuevo.permiso_reportes,
          nivel_acceso: nuevo.nivel_acceso,
          pin_generado_en: new Date().toISOString(),
        };

        const nuevoEmpleado = await createEmpleado(insertData, user);

        if (nuevo.telefono && nuevoEmpleado) {
          // ✅ CORREGIDO: tipar nuevoEmpleado como any temporalmente
          const empleadoCreado = nuevoEmpleado as any;
          fetch('/api/sync-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: nuevo.telefono,
              nombre: nuevo.nombre,
              email: nuevo.email,
              documento_id: nuevo.documento_id,
              empleado_id: empleadoCreado.id
            }),
          }).catch(err => console.error('Error en sync automático:', err));
        }

        if (nuevo.email) {
          setModalConfirmacion({
            isOpen: true,
            empleado: nuevoEmpleado
          });
        } else {
          mostrarNotificacion('Empleado creado correctamente.', 'exito');
        }
        
        cancelarEdicion();
      }
      
      fetchEmpleados();
    } catch (error: any) {
      console.error(error);
      mostrarNotificacion(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // OTRAS FUNCIONES
  // ------------------------------------------------------------
  const cancelarEdicion = () => {
    setEditando(null);
    setNuevo(estadoInicial);
  };

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
      'ID Respond.io': e.respondio_contact_id || '-',
      Sincronizado: e.respondio_sincronizado ? 'SÍ' : 'NO',
      Provincia: user.provinciaNombre || 'Principal'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const columnWidths = [
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
      { wch: 12 }, { wch: 8 },  { wch: 10 }, { wch: 8 },  { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 15 }
    ];
    ws['!cols'] = columnWidths;

    const fechaEmision = new Date().toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const titulo = `EMPLEADOS - ${user.provinciaNombre || 'SISTEMA'}`;
    const empleadoInfo = user ? `${user.nombre} - ${formatearRol(user.rol)}` : 'Sistema';
    const fechaInfo = `Fecha de emisión: ${fechaEmision}`;

    XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(ws, [[empleadoInfo]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(ws, [[fechaInfo]], { origin: 'A3' });
    XLSX.utils.sheet_add_aoa(ws, [['─────────────────────────────────────────────────────────────────']], { origin: 'A4' });

    XLSX.utils.book_append_sheet(wb, ws, "Empleados");
    const timestamp = getTimestamp();
    const filename = `empleados_${timestamp}.xlsx`;
    XLSX.writeFile(wb, filename);
    mostrarNotificacion('✅ ARCHIVO EXPORTADO', 'exito');
  };

  const handleRegresar = () => {
    router.push('/admin');
  };

  const handleSincronizarMasiva = () => {
    router.push('/admin/sincronizar-masiva');
  };

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
        <NotificacionSistema
          mensaje={notificacion.mensaje}
          tipo={notificacion.tipo}
          visible={!!notificacion.tipo}
          duracion={2000}
          onCerrar={() => setNotificacion({ mensaje: '', tipo: null })}
        />

        <div className={`bg-[#0f172a] p-3 rounded-xl border transition-all mb-3 ${editando ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5'}`}>
          <form onSubmit={handleGuardar}>
            <div className="grid grid-cols-9 gap-2">
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
              
              <div className="col-span-1">
                <CampoEntrada
                  label="TELÉFONO"
                  placeholder="+34 XXX XXX XXX"
                  valor={nuevo.telefono}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, telefono: e.target.value })}
                />
              </div>
              
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
              
              <div className="col-span-1">
                <SelectOpcion
                  label="NIVEL"
                  value={nuevo.nivel_acceso}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNuevo({ ...nuevo, nivel_acceso: parseInt(e.target.value) })}
                  options={[1,2,3,4,5,6,7,8,9,10].map(n => ({ value: n, label: n.toString() }))}
                />
              </div>
              
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
              
              {editando && (
                <div className="col-span-1">
                  <CampoEntrada
                    label="PIN"
                    valor={editando.pin_seguridad || ''}
                    onChange={() => {}}
                    disabled
                    mayusculas
                    className="border-blue-500/30"
                  />
                </div>
              )}
              
              <div className="col-span-1 flex items-end gap-1 justify-end">
                <BotonIcono icono="🚫" onClick={cancelarEdicion} color="bg-rose-600" type="button" />
                <BotonIcono icono="✅" onClick={() => {}} color="bg-emerald-600" type="submit" disabled={loading} />
              </div>
            </div>
          </form>
        </div>

        <div className="mb-3">
          <Buscador
            placeholder="BUSCAR EMPLEADO..."
            value={filtro}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFiltro(e.target.value)}
            onClear={() => setFiltro('')}
          />
        </div>

        <div className="mb-3 flex justify-end">
          <button
            onClick={handleSincronizarMasiva}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase"
          >
            🔄 SINCRONIZACIÓN MASIVA
          </button>
        </div>

        <div className="bg-[#0f172a] rounded-xl border border-white/5 overflow-hidden max-h-[60vh] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0f172a] text-[9px] font-black text-slate-400 uppercase tracking-wider sticky top-0 z-30 border-b border-white/10">
                <tr>
                  <th className="p-3">EMPLEADO</th>
                  <th className="p-3">DOCUMENTO / EMAIL / TEL</th>
                  <th className="p-3 text-center">ROL</th>
                  <th className="p-3 text-center">NIV</th>
                  <th className="p-3 text-center">PIN</th>
                  <th className="p-3 text-center">REP</th>
                  <th className="p-3 text-center">ESTADO</th>
                  <th className="p-3 text-center">RESPOND.IO</th>
                  <th className="p-3 text-center" colSpan={4}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-white/20'}`} />
                        <span className="font-bold text-sm uppercase text-white">{emp.nombre}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-[11px] font-mono">
                        <span className="block text-white">{emp.documento_id}</span>
                        <span className="text-slate-500 text-[9px]">{emp.email}</span>
                        {emp.telefono && (
                          <span className="text-emerald-500 text-[9px] block mt-1">
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
                      <BadgeEstado activo={emp.activo} />
                    </td>
                    <td className="p-3 text-center">
                      {emp.respondio_sincronizado ? (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400">
                          ✅ {emp.respondio_contact_id?.substring(0, 6)}...
                        </span>
                      ) : (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-600/20 text-amber-400">
                          ⏳ PENDIENTE
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => editarEmpleado(emp)}
                        className="text-blue-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all"
                      >
                        EDITAR
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => sincronizarConRespondIO(emp)}
                        disabled={!emp.telefono}
                        className={`text-purple-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border transition-all disabled:opacity-50 ${
                          emp.telefono 
                            ? 'border-purple-500/20 hover:bg-purple-600' 
                            : 'border-gray-500/20 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        🔄 SYNC
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleReenviarCorreo(emp)}
                        disabled={enviandoCorreo === emp.id}
                        className="text-emerald-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center gap-1 mx-auto"
                      >
                        {enviandoCorreo === emp.id ? (
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
                        onClick={() => handleEnviarWhatsApp(emp)}
                        disabled={enviandoWhatsApp === emp.id || !emp.telefono}
                        className={`text-emerald-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border transition-all disabled:opacity-50 flex items-center gap-1 mx-auto ${
                          emp.telefono 
                            ? 'border-emerald-500/20 hover:bg-emerald-600' 
                            : 'border-gray-500/20 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {enviandoWhatsApp === emp.id ? (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-150" />
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-300" />
                          </span>
                        ) : (
                          <>
                            <span>📱</span>
                            <span className="text-[8px]">WHATSAPP</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {empleadosFiltrados.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">No hay empleados en esta provincia.</p>
            </div>
          )}
        </div>
      </div>

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
    </main>
  );
}