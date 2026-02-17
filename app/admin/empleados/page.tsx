'use client';
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { enviarEmail } from '@/emails/emailService';
import { 
  CampoEntrada, 
  SelectOpcion, 
  BotonIcono, 
  Buscador, 
  BadgeEstado,
  NotificacionSistema 
} from '../../components';

// ------------------------------------------------------------
// FUNCIONES AUXILIARES
// ------------------------------------------------------------

// Función para formatear rol
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

// Función para enviar correo
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

// ------------------------------------------------------------
// COMPONENTES VISUALES PROPIOS
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR -----
const MemebreteSuperior = ({ usuario, onExportar, onRegresar }: { usuario?: any; onExportar: () => void; onRegresar: () => void }) => {
  const titulo = "GESTOR DE EMPLEADOS";
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
      supabase.removeChannel(channel).catch(error => {
        console.error('Error removing channel:', error);
      });
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
      const existente = docExistente as { id: string; nombre: string };
      mostrarNotificacion(`⚠️ El documento ID ya está registrado para ${existente.nombre}.`, 'advertencia');
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
      const existente = emailExistente as { id: string; nombre: string };
      mostrarNotificacion(`⚠️ El email ya está registrado para ${existente.nombre}.`, 'advertencia');
      return false;
    }

    return true;
  };

  // ------------------------------------------------------------
  // GUARDAR (CREAR O ACTUALIZAR) - CORREGIDO CON AS NEVER
  // ------------------------------------------------------------
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const esValido = await validarDuplicados();
      if (!esValido) { setLoading(false); return; }

      if (editando) {
        // Creamos el objeto sin tipo
        const updateData = {
          nombre: nuevo.nombre,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          rol: nuevo.rol,
          activo: nuevo.activo,
          permiso_reportes: nuevo.permiso_reportes,
          nivel_acceso: nuevo.nivel_acceso,
        };

        // ✅ SOLUCIÓN DEFINITIVA: Usar as never en el parámetro
        const { error } = await supabase
          .from('empleados')
          .update(updateData as never)
          .eq('id', editando.id);
          
        if (error) throw error;
        mostrarNotificacion('Empleado actualizado correctamente.', 'exito');
      } else {
        const { data: pinGenerado, error: pinError } = await supabase.rpc('generar_pin_personal');
        if (pinError) throw new Error('Error al generar PIN: ' + pinError.message);
        if (!pinGenerado) throw new Error('No se pudo generar el PIN');

        const insertData = [{
          nombre: nuevo.nombre,
          documento_id: nuevo.documento_id,
          email: nuevo.email.toLowerCase(),
          pin_seguridad: pinGenerado,
          rol: nuevo.rol,
          activo: nuevo.activo,
          permiso_reportes: nuevo.permiso_reportes,
          nivel_acceso: nuevo.nivel_acceso,
          pin_generado_en: new Date().toISOString(),
        }];

        // ✅ SOLUCIÓN DEFINITIVA: Usar as never en el parámetro
        const { data: nuevoEmpleado, error } = await supabase
          .from('empleados')
          .insert(insertData as never)
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
  // REGRESAR
  // ------------------------------------------------------------
  const handleRegresar = () => {
    router.push('/admin');
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

        {/* FORMULARIO - Grid 8 columnas */}
        <div className={`bg-[#0f172a] p-3 rounded-xl border transition-all mb-3 ${editando ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5'}`}>
          <form onSubmit={handleGuardar}>
            <div className="grid grid-cols-8 gap-2">
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
                  options={obtenerOpcionesNivel().map(n => ({ value: n, label: n.toString() }))}
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

        {/* BUSCADOR */}
        <div className="mb-3">
          <Buscador
            placeholder="BUSCAR EMPLEADO..."
            value={filtro}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFiltro(e.target.value)}
            onClear={() => setFiltro('')}
          />
        </div>

        {/* TABLA */}
        <div className="bg-[#0f172a] rounded-xl border border-white/5 overflow-hidden max-h-[60vh] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0f172a] text-[9px] font-black text-slate-400 uppercase tracking-wider sticky top-0 z-30 border-b border-white/10">
                <tr>
                  <th className="p-3">EMPLEADO</th>
                  <th className="p-3">DOCUMENTO / EMAIL</th>
                  <th className="p-3 text-center">ROL</th>
                  <th className="p-3 text-center">NIV</th>
                  <th className="p-3 text-center">PIN</th>
                  <th className="p-3 text-center">REP</th>
                  <th className="p-3 text-center">ESTADO</th>
                  <th className="p-3 text-center" colSpan={2}>ACCIONES</th>
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
                      <button
                        onClick={() => editarEmpleado(emp)}
                        className="text-blue-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all"
                      >
                        EDITAR
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleReenviarCorreo(emp)}
                        disabled={enviandoCorreo === emp.id}
                        className="text-emerald-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        {enviandoCorreo === emp.id ? '...' : '📧'}
                      </button>
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

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
        select option { background-color: #1f2937; color: white; }
      `}</style>
    </main>
  );
}