// lib/geocodingService.ts
export interface GeocodingResult {
  display_name: string;
  lat?: string;
  lon?: string;
  address?: any;
}

// Cache para evitar solicitudes repetidas
const geocodeCache = new Map<string, GeocodingResult>();

// Función con reintentos y delay
export async function reverseGeocode(
  lat: number, 
  lng: number, 
  retryCount = 0
): Promise<string | null> {
  
  // Crear clave de caché
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  
  // Verificar caché
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)?.display_name || null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'GestionAcceso/1.0 (contacto@tuempresa.com)',
          'Accept-Language': 'es'
        },
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);

    // Manejar errores específicos
    if (response.status === 425) {
      console.log(`⚠️ Rate limit alcanzado, reintentando en ${(retryCount + 1) * 1000}ms...`);
      
      // Esperar y reintentar (delay exponencial)
      if (retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
        return reverseGeocode(lat, lng, retryCount + 1);
      } else {
        return null;
      }
    }

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data && data.display_name) {
      geocodeCache.set(cacheKey, data);
      return data.display_name;
    }
    
    return null;
  } catch (error) {
    console.error('Error en reverseGeocode:', error);
    
    // Reintentar en caso de error de red
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
      return reverseGeocode(lat, lng, retryCount + 1);
    }
    
    return null;
  }
}

export function clearGeocodeCache() {
  geocodeCache.clear();
}