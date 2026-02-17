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
} from '../../../components';

// ------------------------------------------------------------
// FUNCIONES AUXILIARES (DEFINIDAS PRIMERO)
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

// Función para enviar correo de flota
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

// ------------------------------------------------------------
// COMPONENTES VISUALES PROPIOS
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR -----
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

      if (errEmail) { mostrarNotificacion('Error al validar email', 'error'); return false; }
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
      if (!esValido) { setLoading(false); return; }

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
          .insert([{
            nombre_completo: nuevo.nombre_completo,
            documento_id: nuevo.documento_id,
            email: nuevo.email.toLowerCase(),
            nombre_flota: nuevo.nombre_flota,
            cant_choferes: nuevo.cant_choferes,
            cant_rutas: nuevo.cant_rutas,
            pin_secreto: pinGenerado,
            activo: true,
            fecha_creacion: new Date().toISOString(),
          }])
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
  // CAMBIAR ESTADO ACTIVO/INACTIVO
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

        {/* FORMULARIO - Grid 8 columnas */}
        <div className={`bg-[#0f172a] p-3 rounded-xl border transition-all mb-3 ${editando ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5'}`}>
          <form onSubmit={handleGuardar}>
            <div className="grid grid-cols-8 gap-2">
              <div className="col-span-1">
                <CampoEntrada
                  label="NOMBRE"
                  placeholder="Nombre"
                  valor={nuevo.nombre_completo}  // ✅ CORREGIDO: value → valor
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, nombre_completo: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="col-span-1">
                <CampoEntrada
                  label="DOCUMENTO"
                  placeholder="DNI"
                  valor={nuevo.documento_id}  // ✅ CORREGIDO
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, documento_id: e.target.value })}
                  required
                  mayusculas  // ✅ CORREGIDO: uppercase → mayusculas
                />
              </div>
              <div className="col-span-1">
                <CampoEntrada
                  label="EMAIL"
                  placeholder="Email"
                  tipo="email"
                  valor={nuevo.email}  // ✅ CORREGIDO
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, email: e.target.value })}
                />
              </div>
              <div className="col-span-1">
                <CampoEntrada
                  label="FLOTA"
                  placeholder="Empresa"
                  valor={nuevo.nombre_flota}  // ✅ CORREGIDO
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, nombre_flota: e.target.value })}
                />
              </div>
              <div className="col-span-1">
                <SelectOpcion
                  label="CHOFERES"
                  value={nuevo.cant_choferes}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNuevo({ ...nuevo, cant_choferes: parseInt(e.target.value) })}
                  options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: (i + 1).toString() }))}
                />
              </div>
              <div className="col-span-1">
                <SelectOpcion
                  label="RUTAS"
                  value={nuevo.cant_rutas}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNuevo({ ...nuevo, cant_rutas: parseInt(e.target.value) })}
                  options={Array.from({ length: 21 }, (_, i) => ({ value: i, label: i.toString() }))}
                />
              </div>
              {editando && (
                <div className="col-span-1">
                  <CampoEntrada
                    label="PIN"
                    valor={editando.pin_secreto || ''}  // ✅ CORREGIDO
                    onChange={() => {}}  // ✅ AGREGADO: función vacía para campo deshabilitado
                    disabled
                    mayusculas  // ✅ CORREGIDO
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
            placeholder="BUSCAR PERFIL..."
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
                  <th className="p-3">NOMBRE</th>
                  <th className="p-3">DOCUMENTO</th>
                  <th className="p-3">EMAIL</th>
                  <th className="p-3">FLOTA</th>
                  <th className="p-3 text-center">CHOF</th>
                  <th className="p-3 text-center">RUT</th>
                  <th className="p-3 text-center">PIN</th>
                  <th className="p-3 text-center">EST</th>
                  <th className="p-3 text-center" colSpan={2}>ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {perfilesFiltrados.map((perfil) => (
                  <tr key={perfil.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <span className="font-bold text-sm uppercase text-white">{perfil.nombre_completo}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px]">{perfil.documento_id}</td>
                    <td className="p-3 text-[11px]">{perfil.email}</td>
                    <td className="p-3 text-[11px]">{perfil.nombre_flota || '-'}</td>
                    <td className="p-3 text-center font-black text-[11px]">{perfil.cant_choferes}</td>
                    <td className="p-3 text-center font-black text-[11px]">{perfil.cant_rutas}</td>
                    <td className="p-3 text-center">
                      <div className="group relative inline-block">
                        <span className="text-[10px] font-mono text-slate-600 group-hover:hidden tracking-widest">••••••</span>
                        <span className="text-[10px] font-mono text-amber-500 hidden group-hover:block font-bold">{perfil.pin_secreto}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <BadgeEstado activo={perfil.activo} textoActivo="ACT" textoInactivo="INA" />
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => editarPerfil(perfil)}
                        className="text-blue-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-600 transition-all"
                      >
                        EDITAR
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleReenviarCorreo(perfil)}
                        disabled={enviandoCorreo === perfil.id}
                        className="text-emerald-500 hover:text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        {enviandoCorreo === perfil.id ? '...' : '📧'}
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