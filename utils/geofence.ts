// utils/geofence.ts

// 1. Coordenadas del almacén (Asegúrate de que sean puntos distintos del edificio)
export const WAREHOUSE_POINTS = [
  { lat: 40.59674019380782, lng: -3.5953644367535533 }, // Puerta Principal
  { lat: 40.59674019380781, lng: -3.5953644367535534 },                 // Muelle de Carga
  { lat: 40.59674019380780, lng: -3.5953644367535535 }                  // Salida de Emergencia
];

/**
 * Calcula la distancia entre dos puntos usando la fórmula Haversine
 */
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Radio de la tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

/**
 * Valida si el usuario está a menos de 50 metros de cualquier punto del almacén
 */
export const checkGeofence = (userLat: number, userLng: number): boolean => {
  return WAREHOUSE_POINTS.some(point => {
    const distance = getDistance(userLat, userLng, point.lat, point.lng);
    return distance <= 50; // Margen de seguridad de 50 metros
  });
};