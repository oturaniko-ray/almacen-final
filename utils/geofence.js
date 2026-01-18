// utils/geofence.js

// 1. Aquí colocamos tus coordenadas reales que proporcionaste
export const WAREHOUSE_POINTS = [
  { lat: 40.596796067183284, lng: -3.5954137370500554 },
  { lat: 40.59660531900063, lng: -3.5950704530829594 },
  { lat: 40.59660531900063, lng: -3.5950704530829594 }
];

// 2. Esta función calcula la distancia real en metros (Fórmula Haversine)
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Radio de la tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

// 3. Esta es la función que tú tenías, ahora usando la lógica de arriba
export const checkGeofence = (userLat, userLng) => {
  return WAREHOUSE_POINTS.some(point => {
    const distance = getDistance(userLat, userLng, point.lat, point.lng);
    return distance <= 50; // Margen de 50 metros
  });
};

40.59660531900063, -3.5950704530829594