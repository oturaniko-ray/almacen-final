const registrarAcceso = async () => {
  if (gps.dist > config.radio) {
    mostrarNotificacion(`FUERA DE RANGO: ${gps.dist}m`, 'error');
    resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    return;
  }

  setAnimar(true);

  const ahora = new Date().toISOString();
  const inputBusqueda = qrData.trim();

  if (!inputBusqueda) {
    mostrarNotificacion('ERROR: DOCUMENTO VACÍO', 'error');
    resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    return;
  }

  // --- Determinar tipo de QR ---
  let tipo = '';
  if (modo === 'manual') {
    tipo = 'desconocido';
  } else {
    if (qrInfo) {
      tipo = qrInfo.tipo;
    } else {
      mostrarNotificacion('ERROR: Información de QR no disponible', 'error');
      setAnimar(false);
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
      return;
    }
  }

  // --- Buscar en la tabla correspondiente ---
  let registro = null;

  if (modo === 'manual') {
    const { data: emp } = await supabase
      .from('empleados')
      .select('id, nombre, pin_seguridad, activo, documento_id, email')
      .or(`documento_id.ilike.%${inputBusqueda}%,email.ilike.%${inputBusqueda.toLowerCase()}%`)
      .maybeSingle();
    if (emp) {
      registro = { ...emp, tipo: 'empleado' };
    } else {
      const { data: flota } = await supabase
        .from('flota_perfil')
        .select('*')
        .eq('documento_id', inputBusqueda)
        .maybeSingle();
      if (flota) {
        registro = { ...flota, tipo: 'flota' };
      }
    }
  } else {
    if (tipo === 'P') {
      const { data: emp, error: empErr } = await supabase
        .from('empleados')
        .select('id, nombre, pin_seguridad, activo, documento_id, email')
        .or(`documento_id.ilike.%${inputBusqueda}%,email.ilike.%${inputBusqueda.toLowerCase()}%`)
        .maybeSingle();
      if (empErr) {
        mostrarNotificacion(`ERROR DB: ${empErr.message}`, 'error');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara' | 'manual');
        return;
      }
      if (emp) {
        registro = { ...emp, tipo: 'empleado' };
      }
    } else if (tipo === 'F') {
      const { data: flota, error: flotaErr } = await supabase
        .from('flota_perfil')
        .select('*')
        .eq('documento_id', inputBusqueda)
        .maybeSingle();
      if (flotaErr) {
        mostrarNotificacion(`ERROR DB: ${flotaErr.message}`, 'error');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara' | 'manual');
        return;
      }
      if (flota) {
        registro = { ...flota, tipo: 'flota' };
      }
    }
  }

  if (!registro) {
    mostrarNotificacion('ID NO REGISTRADO', 'error');
    setAnimar(false);
    resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    return;
  }

  if (registro.tipo === 'empleado' && !registro.documento_id) {
    mostrarNotificacion('EMPLEADO SIN DOCUMENTO ID', 'error');
    setAnimar(false);
    resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    return;
  }
  if (registro.tipo === 'empleado' && !registro.activo) {
    mostrarNotificacion('EMPLEADO INACTIVO', 'error');
    setAnimar(false);
    resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    return;
  }
  if (registro.tipo === 'flota' && !registro.activo) {
    mostrarNotificacion('PERFIL DE FLOTA INACTIVO', 'error');
    setAnimar(false);
    resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    return;
  }

  // --- Validar PIN del trabajador (solo modo manual) ---
  if (modo === 'manual') {
    if (registro.tipo === 'empleado' && String(registro.pin_seguridad) !== String(pinEmpleado)) {
      mostrarNotificacion('PIN TRABAJADOR INCORRECTO', 'error');
      setAnimar(false);
      resetearPorModo('manual', 'pin_trabajador');
      return;
    }
    if (registro.tipo === 'flota' && String(registro.pin_secreto) !== String(pinEmpleado)) {
      mostrarNotificacion('PIN CHOFER INCORRECTO', 'error');
      setAnimar(false);
      resetearPorModo('manual', 'pin_trabajador');
      return;
    }
  }

  // --- Validar PIN del autorizador (usuario logueado) ---
  
  // Obtener el ID del usuario logueado desde la sesión
  const sessionData = localStorage.getItem('user_session');
  if (!sessionData) {
    mostrarNotificacion('SESIÓN NO VÁLIDA', 'error');
    setAnimar(false);
    resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    return;
  }

  const usuarioLogueado = JSON.parse(sessionData);

  // Validar que el PIN ingresado corresponda al usuario logueado
  const { data: autorizador, error: errorAutorizador } = await supabase
    .from('empleados')
    .select('nombre, rol')
    .eq('id', usuarioLogueado.id)
    .eq('pin_seguridad', String(pinAutorizador))
    .maybeSingle();

  if (errorAutorizador || !autorizador) {
    mostrarNotificacion('PIN INCORRECTO', 'error');
    setAnimar(false);
    
    if (modo === 'manual') {
      resetearPorModo('manual', 'pin_administrador');
    } else {
      resetearPorModo(modo as 'usb' | 'camara', 'pin_supervisor');
    }
    return;
  }

  // Verificar que tenga el rol apropiado según el modo
  const rolesValidos = modo === 'manual' 
    ? ['admin', 'administrador', 'Administrador'] 
    : ['supervisor', 'admin', 'administrador', 'Administrador'];

  if (!rolesValidos.includes(autorizador.rol)) {
    mostrarNotificacion(
      modo === 'manual' 
        ? 'SE REQUIERE ROL ADMINISTRADOR' 
        : 'SE REQUIERE ROL SUPERVISOR O ADMIN', 
      'error'
    );
    setAnimar(false);
    
    if (modo === 'manual') {
      resetearPorModo('manual', 'pin_administrador');
    } else {
      resetearPorModo(modo as 'usb' | 'camara', 'pin_supervisor');
    }
    return;
  }

  const firma = `Autoriza ${autorizador.nombre} - ${modo.toUpperCase()}`;

  // --- Validación de duplicidad de entrada/salida ---
  if (registro.tipo === 'empleado') {
    if (direccion === 'entrada') {
      const { data: jornadaActiva } = await supabase
        .from('jornadas')
        .select('id')
        .eq('empleado_id', registro.id)
        .is('hora_salida', null)
        .maybeSingle();
      if (jornadaActiva) {
        mostrarNotificacion('YA TIENE UNA ENTRADA ACTIVA', 'advertencia');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara' | 'manual');
        return;
      }
    } else {
      const { data: jornadaActiva } = await supabase
        .from('jornadas')
        .select('id')
        .eq('empleado_id', registro.id)
        .is('hora_salida', null)
        .maybeSingle();
      if (!jornadaActiva) {
        mostrarNotificacion('NO HAY ENTRADA REGISTRADA', 'advertencia');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara' | 'manual');
        return;
      }
    }
  } else if (registro.tipo === 'flota') {
    if (direccion === 'entrada') {
      const { data: accesoActivo } = await supabase
        .from('flota_accesos')
        .select('id')
        .eq('perfil_id', registro.id)
        .is('hora_salida', null)
        .maybeSingle();
      if (accesoActivo) {
        mostrarNotificacion('YA TIENE UNA ENTRADA ACTIVA (FLOTA)', 'advertencia');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara' | 'manual');
        return;
      }
    } else {
      const { data: accesoActivo } = await supabase
        .from('flota_accesos')
        .select('id')
        .eq('perfil_id', registro.id)
        .is('hora_salida', null)
        .maybeSingle();
      if (!accesoActivo) {
        mostrarNotificacion('NO HAY ENTRADA REGISTRADA (FLOTA)', 'advertencia');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara' | 'manual');
        return;
      }
    }
  }

  // --- Ejecutar registro ---
  try {
    if (registro.tipo === 'empleado') {
      if (direccion === 'entrada') {
        const { error: insErr } = await supabase.from('jornadas').insert([{
          empleado_id: registro.id,
          nombre_empleado: registro.nombre,
          hora_entrada: ahora,
          autoriza_entrada: firma,
          estado: 'activo',
        }]);
        if (insErr) throw insErr;
        await supabase
          .from('empleados')
          .update({ en_almacen: true, ultimo_ingreso: ahora })
          .eq('id', registro.id);
      } else {
        const { data: j } = await supabase
          .from('jornadas')
          .select('*')
          .eq('empleado_id', registro.id)
          .is('hora_salida', null)
          .order('hora_entrada', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!j) throw new Error('No se encontró entrada activa');
        const horas = parseFloat(((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2));
        const { error: updErr } = await supabase
          .from('jornadas')
          .update({
            hora_salida: ahora,
            horas_trabajadas: horas,
            autoriza_salida: firma,
            estado: 'finalizado',
          })
          .eq('id', j.id);
        if (updErr) throw updErr;
        await supabase
          .from('empleados')
          .update({ en_almacen: false, ultima_salida: ahora })
          .eq('id', registro.id);
      }
      mostrarNotificacion(`${direccion === 'entrada' ? 'ENTRADA' : 'SALIDA'} REGISTRADA ✅`, 'exito');
    } else {
      // FLOTA
      if (direccion === 'entrada') {
        const { error: insErr } = await supabase.from('flota_accesos').insert([{
          perfil_id: registro.id,
          nombre_completo: registro.nombre_completo,
          documento_id: registro.documento_id,
          cant_choferes: registro.cant_choferes,
          hora_llegada: ahora,
          estado: 'en_patio',
          autorizado_por: autorizador.nombre,
        }]);
        if (insErr) throw insErr;
        mostrarNotificacion('ENTRADA DE FLOTA REGISTRADA ✅', 'exito');
      } else {
        // SALIDA de flota: necesitamos cant_carga y observacion
        if (!flotaSalida.activo) {
          setFlotaSalida(prev => ({ ...prev, activo: true }));
          setAnimar(false);
          setTimeout(() => cargaRef.current?.focus(), 100);
          return;
        }

        const { data: accesoActivo } = await supabase
          .from('flota_accesos')
          .select('*')
          .eq('perfil_id', registro.id)
          .is('hora_salida', null)
          .order('hora_llegada', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!accesoActivo) throw new Error('No hay acceso activo');

        const horasEnPatio = parseFloat(((Date.now() - new Date(accesoActivo.hora_llegada).getTime()) / 3600000).toFixed(2));

        const { error: updErr } = await supabase
          .from('flota_accesos')
          .update({
            hora_salida: ahora,
            cant_carga: flotaSalida.cant_carga,
            observacion: flotaSalida.observacion,
            estado: 'despachado',
          })
          .eq('id', accesoActivo.id);

        if (updErr) throw updErr;

        mostrarNotificacion('SALIDA DE FLOTA REGISTRADA ✅', 'exito');
        setFlotaSalida({ activo: false, cant_carga: 0, observacion: '' });
      }
    }

    setTimeout(() => {
      if (modo === 'manual') {
        setPasoManual(1);
        setQrData('');
        setQrInfo(null);
        setPinEmpleado('');
        setPinAutorizador('');
        setTimeout(() => documentoRef.current?.focus(), 100);
      } else {
        setLecturaLista(false);
        setQrData('');
        setQrInfo(null);
        setPinAutorizador('');
        setTimeout(() => {
          if (modo === 'usb') {
            const usbInput = document.querySelector('input[placeholder="ESPERANDO QR..."]') as HTMLInputElement;
            if (usbInput) usbInput.focus();
          }
        }, 100);
      }
    }, 2000);
  } catch (e: any) {
    console.error('Error inesperado:', e);
    mostrarNotificacion(`ERROR: ${e.message}`, 'error');
    resetearPorModo(modo as 'usb' | 'camara' | 'manual');
  } finally {
    setAnimar(false);
  }
};