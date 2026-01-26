'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONSTANTES DE SEGURIDAD MANTENIDAS
const ALMACEN_LAT = 40.59682191301211; 
const ALMACEN_LON = -3.5952475579699485;
const RADIO_MAXIMO_METROS = 80; 
const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [user, setUser] = useState<any>(null);
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = false;
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.push('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);

    const canalSesion = supabase.channel('supervisor-session-control');

    canalSesion
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.email === currentUser.email && payload.payload.id !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => {
            localStorage.removeItem('user_session');
            router.push('/');
          }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSesion.send({
            type: 'broadcast',
            event: 'nueva-sesion',
            payload: { id: sessionId.current, email: currentUser.email },
          });
        }
      });

    return () => { supabase.removeChannel(canalSesion); };
  }, [router]);

  const volverAtras = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch (e) { console.warn("Error deteniendo cámara:", e); }

    if (direccion) {
      setDireccion(null); setQrData(''); setPinAutorizador(''); setPinEmpleadoManual(''); setLecturaLista(false);
    } else if (modo !== 'menu') { 
      setModo('menu'); 
    }
  };

  const prepararSiguienteEmpleado = () => {
    setQrData(''); setPinEmpleadoManual(''); setPinAutorizador(''); setLecturaLista(false); setAnimar(false);
    if (modo === 'manual') setTimeout(() => docInputRef.current?.focus(), 100);
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) { setQrData(buffer.trim()); setLecturaLista(true); setTimeout(() => pinRef.current?.focus(), 100); }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) {
      const iniciarCamara = async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
            setQrData(text); setLecturaLista(true);
            scanner.stop().then(() => { scannerRef.current = null; });
            setTimeout(() => pinRef.current?.focus(), 200);
          }, () => {});
        } catch (err) { console.error("Error cámara:", err); }
      };
      setTimeout(iniciarCamara, 300); 
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {}); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        let identificadorFinal = qrData.trim();
        
        // --- ALGORITMO ORIGINAL (RESTAURADO) ---
        if (modo !== 'manual') {
          try {
            const decoded = atob(identificadorFinal).split('|');
            if (decoded.length === 2) {
              const [docId, timestamp] = decoded;
              if (Date.now() - parseInt(timestamp) > TIEMPO_MAX_TOKEN_MS) {
                throw new Error("TOKEN EXPIRADO");
              }
              identificadorFinal = docId;
            }
          } catch (e: any) {
            if (e.message === "TOKEN EXPIRADO") throw e;
          }
        }

        const { data: emp, error: empError } = await supabase
          .from('empleados')
          .select('id, nombre, estado, pin_seguridad, documento_id, email')
          .or(`documento_id.eq.${identificadorFinal},email.eq.${identificadorFinal}`)
          .maybeSingle();
        
        if (empError || !emp) throw new Error("Empleado no encontrado");

        // 🛡️ ÚNICO AJUSTE SOLICITADO: VALIDACIÓN DE ESTADO
        if (emp.estado !== true) {
          throw new Error("Persona no tiene acceso a las instalaciones ya que no presta servicio en esta Empresa");
        }

        if (modo === 'manual' && emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN del Empleado incorrecto");
        
        const { data: autorizador } = await supabase.from('empleados').select('nombre, rol').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
        if (!autorizador) throw new Error("PIN de Supervisor/Admin inválido");

        const { data: jornadaActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

        if (direccion === 'entrada') {
          if (jornadaActiva) throw new Error(`Entrada ya activa (${new Date(jornadaActiva.hora_entrada).toLocaleTimeString()})`);
          await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: new Date().toISOString(), estado: 'activo' }]);
          await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        } else {
          if (!jornadaActiva) throw new Error("No hay entrada registrada");
          const ahora = new Date();
          const horas = (ahora.getTime() - new Date(jornadaActiva.hora_entrada).getTime()) / 3600000;
          await supabase.from('jornadas').update({ hora_salida: ahora.toISOString(), horas_trabajadas: horas, estado: 'finalizado', editado_por: `Autoriza: ${autorizador.nombre}` }).eq('id', jornadaActiva.id);
          await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        }

        alert(`✅ Éxito: ${emp.nombre}`);
        prepararSiguienteEmpleado();
      } catch (err: any) { 
        alert(`❌ ${err.message}`); 
        setAnimar(false); 
      }
    }, () => { alert("GPS Obligatorio"); setAnimar(false); }, { enableHighAccuracy: true });
  };

  // ... (Resto del renderizado JSX se mantiene idéntico a tu original)