// lib/geocodingService.ts
export interface GeocodingResult {
  display_name: string;
  lat?: string;
  lon?: string;
  address?: any;
}

// Cache para evitar solicitudes repetidas
const geocodeCache = new Map<string, GeocodingResult>();

// Función con reintentos y delay - AHORA USA EL PROXY
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
    
    // ✅ Usar nuestro propio endpoint API (evita CORS)
    const response = await fetch(
      `/api/geocode?lat=${lat}&lng=${lng}`,
      {
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.display_name) {
      geocodeCache.set(cacheKey, data);
      return data.display_name;
    }
    
    return null;
  } catch (error) {
    console.error('Error en reverseGeocode:', error);
    
    // Reintentar en caso de error
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