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

// Obtener ubicación desde IP (gratuito, sin API key)
export async function getLocationFromIP(): Promise<LocationData | null> {
  try {
    const response = await fetch('http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,query');
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
    console.error('Error getting location from IP:', error);
    return null;
  }
}

// GPS con opciones mejoradas
export async function getLocationFromGPS(): Promise<LocationData | null> {
  if (!navigator.geolocation) {
    console.error('Geolocation not supported');
    return null;
  }

  try {
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: 'gps',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error getting GPS location:', error);
    return null;
  }
}

// Guardar ubicación en localStorage (caché)
export function cacheLocation(location: LocationData): void {
  try {
    const cache = {
      ...location,
      timestamp: Date.now()
    };
    localStorage.setItem('last_location', JSON.stringify(cache));
  } catch (error) {
    console.error('Error caching location:', error);
  }
}

// Obtener ubicación de caché (válida por 1 hora)
export function getCachedLocation(): LocationData | null {
  try {
    const cached = localStorage.getItem('last_location');
    if (!cached) return null;

    const location = JSON.parse(cached) as LocationData;
    const oneHour = 60 * 60 * 1000;
    
    if (Date.now() - location.timestamp > oneHour) {
      localStorage.removeItem('last_location');
      return null;
    }
    
    return { ...location, source: 'cache' };
  } catch (error) {
    console.error('Error getting cached location:', error);
    return null;
  }
}

// Obtener dirección a partir de coordenadas
export async function getAddressFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'GestionAcceso/1.0'
        }
      }
    );
    
    const data = await response.json();
    
    if (data.display_name) {
      return data.display_name;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting address:', error);
    return null;
  }
}

// Función principal para obtener ubicación (con fallbacks)
export async function getCurrentLocation(): Promise<LocationData | null> {
  // 1. Intentar GPS primero
  console.log('📍 Intentando obtener ubicación por GPS...');
  const gpsLocation = await getLocationFromGPS();
  
  if (gpsLocation) {
    console.log('✅ GPS exitoso');
    cacheLocation(gpsLocation);
    return gpsLocation;
  }

  // 2. Fallback: IP Geolocation
  console.log('⚠️ GPS falló, intentando con IP...');
  const ipLocation = await getLocationFromIP();
  
  if (ipLocation) {
    console.log('✅ IP geolocation exitoso');
    cacheLocation(ipLocation);
    return ipLocation;
  }

  // 3. Último recurso: caché
  console.log('⚠️ Todo falló, usando caché...');
  const cachedLocation = getCachedLocation();
  
  if (cachedLocation) {
    console.log('✅ Caché exitoso');
    return cachedLocation;
  }

  console.error('❌ No se pudo obtener ubicación');
  return null;
}