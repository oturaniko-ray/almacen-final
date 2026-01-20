'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const [coordenadas, setCoordenadas] = useState('');
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // VALIDACIÓN DE SESIÓN ÚNICA
  const validarSesionUnica = useCallback(async () => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    const session = JSON.parse(sessionStr);
    const { data: dbUser } = await supabase.from('empleados').select('session_token, activo, rol').eq('id', session.id).single();

    if (!dbUser || dbUser.session_token !== session.session_token || !dbUser.activo || dbUser.rol !== 'supervisor') {
      localStorage.clear();
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    validarSesionUnica();
    const interval = setInterval(validarSesionUnica, 15000);
    return () => clearInterval(interval);
  }, [validarSesionUnica]);

  // GEOLOCALIZACIÓN
  useEffect(() => {
    if (direccion) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoordenadas(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`),
        () => setCoordenadas('GPS Denegado'),
        { enableHighAccuracy: true }
      );
    }
  }, [direccion]);

  // FUNCIÓN PARA DETENER CÁMARA DE FORMA SEGURA
  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Error al detener cámara:", err);
      }
    }
  };

  const handleVolver = async () => {
    setQrData(''); setPin(''); setPinSupervisor('');
    if (direccion) { 
      await stopScanner();
      setDireccion(null); 
    } else if (modo !== 'menu') { 
      await stopScanner();
      setModo('menu'); 
    } else { 
      router.push('/'); 
    }
  };

  // LÓGICA USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const limpio = buffer.replace(/(ScrollLock|AltGraph|Control|Shift|CapsLock|Alt|Meta|Tab)/gi, "").trim();
        if (limpio) {
          setAnimar(true);
          setTimeout(() => { 
            setQrData(limpio); 
            setAnimar(false); 
            setTimeout(() => pinRef.current?.focus(), 150); 
          }, 500);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // LÓGICA CÁMARA (CORREGIDA)
  useEffect(() => {
    let isMounted = true;
    
    const startCamera = async () => {
      if (modo === 'camara' && direccion && !qrData) {
        // Pequeño delay para asegurar que el div 'reader' existe en el DOM
        await new Promise(r => setTimeout(r, 600)); 
        if (!isMounted) return;

        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" }, 
            { fps: 20, qrbox: { width: 250, height: 250 } }, 
            (text) => {
              setQrData(text);
              stopScanner();
              setTimeout(() => pinRef.current?.focus(), 250);
            },
            () => {} // Ignorar errores de escaneo silenciosos
          );
        } catch (err) {
          console.error("Error al iniciar cámara:", err);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    if (intentosFallidos >= 3) { alert("❌ BLOQUEADO POR INTENTOS"); return; }
    const idLimpio = qrData.split('|')[0].trim();
    const supSession = JSON.parse(localStorage.getItem('user_session') || '{}');

    const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', idLimpio).single();

    if (!emp || !emp.activo || emp.pin_seguridad !== pin.trim()) {
      alert("❌ DATOS INCORRECTOS");
      setPin(''); return;
    }

    if (modo === 'manual') {
      const { data: sup } = await supabase.from('empleados').select('*').eq('id', supSession.id).eq('pin_seguridad', pinSupervisor.trim()).single();
      if (!sup) {
        set