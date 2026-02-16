// lib/locationService.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  source: 'gps' | 'ip' | 'cache';
  address?: string;
  timestamp: number;
}

// Obtener ubicación desde IP (con timeout y mejor manejo)
export async function getLocationFromIP(): Promise<LocationData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,query', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        lat: data.lat,
        lng: data.lon,
        accuracy: 1000,
        source: 'ip',
        address: `${data.city}, ${data.regionName}, ${data.country}`,
        timestamp: Date.now()
      };
    }
    return null;
  } catch (error) {
    console.log('📍 IP geolocation timeout or error');
    return null;
  }
}

// GPS con opciones mejoradas y múltiples intentos
export async function getLocationFromGPS(retryCount = 0): Promise<LocationData | null> {
  if (!navigator.geolocation) {
    console.log('📍 Geolocation not supported');
    return null;
  }

  try {
    // Primero intentamos con alta precisión
    const options = {
      enableHighAccuracy: true,
      timeout: 8000, // Reducido de 10s a 8s
      maximumAge: 60000 // Aceptar caché de hasta 1 minuto
    };

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
      
      // Timeout adicional por si acaso
      setTimeout(() => reject(new Error('GPS timeout')), 9000);
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: 'gps',
      timestamp: Date.now()
    };
  } catch (error) {
    // Si falla el primer intento y no hemos reintentado, probamos con baja precisión
    if (retryCount === 0) {
      console.log('📍 GPS alta precisión falló, intentando con baja precisión...');
      try {
        const lowAccuracyOptions = {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 120000
        };

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, lowAccuracyOptions);
        });

        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 100,
          source: 'gps',
          timestamp: Date.now()
        };
      } catch (lowError) {
        console.log('📍 GPS también falló en baja precisión');
        return null;
      }
    }
    return null;
  }
}

// Guardar ubicación en localStorage
export function cacheLocation(location: LocationData): void {
  try {
    const cache = {
      ...location,
      timestamp: Date.now()
    };
    localStorage.setItem('last_location', JSON.stringify(cache));
  } catch (error) {
    // Silencioso
  }
}

// Obtener ubicación de caché (válida por 30 minutos)
export function getCachedLocation(): LocationData | null {
  try {
    const cached = localStorage.getItem('last_location');
    if (!cached) return null;

    const location = JSON.parse(cached) as LocationData;
    const thirtyMinutes = 30 * 60 * 1000;
    
    if (Date.now() - location.timestamp > thirtyMinutes) {
      localStorage.removeItem('last_location');
      return null;
    }
    
    return { ...location, source: 'cache' };
  } catch (error) {
    return null;
  }
}

// Obtener dirección a partir de coordenadas
export async function getAddressFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'GestionAcceso/1.0'
        },
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    const data = await response.json();
    
    if (data.display_name) {
      return data.display_name;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Función principal con mejor manejo de errores
export async function getCurrentLocation(): Promise<LocationData | null> {
  // Verificar si el navegador soporta geolocalización
  if (!navigator.geolocation) {
    console.log('📍 Navegador no soporta geolocalización');
  }

  // 1. Intentar GPS primero (con reintento automático)
  const gpsLocation = await getLocationFromGPS();
  
  if (gpsLocation) {
    cacheLocation(gpsLocation);
    return gpsLocation;
  }

  // 2. Fallback: IP Geolocation
  console.log('📍 GPS falló, intentando con IP...');
  const ipLocation = await getLocationFromIP();
  
  if (ipLocation) {
    cacheLocation(ipLocation);
    return ipLocation;
  }

  // 3. Último recurso: caché
  console.log('📍 Todo falló, usando caché...');
  const cachedLocation = getCachedLocation();
  
  if (cachedLocation) {
    return cachedLocation;
  }

  console.log('📍 No se pudo obtener ubicación');
  return null;
}